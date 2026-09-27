import { dayNumberForDate, isValidISODate } from '../lib/dates'
import { isDayComplete } from '../logic/dayCompletion'
import { isChallengeDay } from '../logic/days'
import { challengeWeek, RULESETS, rulesFor, type Ruleset } from '../logic/rulesets'
import { toDayTaskData } from './mappers'
import type { Badge, Challenge, DayEntry, Workout } from './types'

export interface NormalizableRecords {
  challenges: Challenge[]
  dayEntries: DayEntry[]
  workouts: Workout[]
  badges: Badge[]
}

export interface NormalizationReport {
  startDatesRepaired: number
  attemptsRenumbered: number
  extraActiveChallengesArchived: number
  dayNumbersRepaired: number
  duplicateDayEntriesMerged: number
  duplicateBadgesRemoved: number
  /** `socialDays` entries a challenge's rules don't allow, and `restDay` flags a week already had — all dropped. */
  invalidFlagsCleared: number
}

/**
 * Repairs data written before the v3 schema's uniqueness rules existed (or
 * found in an old backup), so it can be stored under them:
 * - invalid start dates → the challenge's earliest entry date, else `today`;
 * - colliding or invalid attempt numbers → renumbered in their existing order;
 * - more than one active challenge → all but the latest archived as failed;
 * - invalid day numbers → recomputed from the entry's date;
 * - a challenge's `socialDays` past what its rules allow, or more than one
 *   per challenge week → trimmed to the earliest per week (none at all when
 *   the rules allow no social days);
 * - a day entry's `restDay` the challenge's rules don't allow, or a week's
 *   second one → dropped, and `completed` recomputed for every day entry
 *   that loses a rest day or a declared social day this way;
 * - several entries for one challenge day → merged into the oldest (most of
 *   each field, workouts moved over, `completed` recomputed);
 * - the same badge unlocked twice in one attempt → the earliest one kept.
 *
 * Nothing that holds user data is dropped: merged entries keep every
 * workout, and photos aren't touched at all. Pure — the v2 upgrade and the
 * JSON import both use it.
 */
export function normalizeRecords(
  records: NormalizableRecords,
  today: string,
): NormalizableRecords & { report: NormalizationReport } {
  const report: NormalizationReport = {
    startDatesRepaired: 0,
    attemptsRenumbered: 0,
    extraActiveChallengesArchived: 0,
    dayNumbersRepaired: 0,
    duplicateDayEntriesMerged: 0,
    duplicateBadgesRemoved: 0,
    invalidFlagsCleared: 0,
  }

  const normalizedChallenges = normalizeChallenges(records.challenges, records.dayEntries, today, report)
  const startDateById = new Map(normalizedChallenges.map((c) => [c.id, c.startDate]))
  const rulesByChallenge = new Map(normalizedChallenges.map((c) => [c.id, rulesFor(c)]))

  const dayNumberRepaired = records.dayEntries.map((entry) => {
    if (isChallengeDay(entry.dayNumber)) return entry
    const startDate = startDateById.get(entry.challengeId)
    const dayNumber = startDate ? dayNumberForDate(startDate, entry.date) : Number.NaN
    if (!isChallengeDay(dayNumber)) return entry // can't be placed; it simply stays unindexed
    report.dayNumbersRepaired++
    return { ...entry, dayNumber }
  })

  const { challenges, removedSocialDaysByChallenge } = cleanSocialDays(normalizedChallenges, rulesByChallenge, report)
  const socialDaysByChallenge = new Map(challenges.map((c) => [c.id, c.socialDays]))

  const { dayEntries: restDaysCleaned, changedEntryIds } = cleanRestDays(dayNumberRepaired, rulesByChallenge, report)

  const dayEntries = restDaysCleaned.map((entry) => {
    const lostSocialDay = removedSocialDaysByChallenge.get(entry.challengeId)?.has(entry.dayNumber) ?? false
    if (!changedEntryIds.has(entry.id) && !lostSocialDay) return entry
    const rules = rulesByChallenge.get(entry.challengeId) ?? RULESETS.hard
    const socialDays = socialDaysByChallenge.get(entry.challengeId)
    const entryWorkouts = records.workouts.filter((w) => w.dayEntryId === entry.id)
    return { ...entry, completed: isDayComplete(toDayTaskData(entry, entryWorkouts, socialDays), rules) }
  })

  const merged = mergeDuplicateDayEntries(dayEntries, records.workouts, rulesByChallenge, socialDaysByChallenge, report)
  const badges = dedupeBadges(records.badges, report)

  return { challenges, dayEntries: merged.dayEntries, workouts: merged.workouts, badges, report }
}

/**
 * Keeps only the `socialDays` a challenge's rules allow: none when the rules
 * allow no social days at all, else the sorted, de-duplicated day numbers,
 * one per challenge week (the earliest). An empty result removes the field.
 * Returns which day numbers were dropped per challenge, so their entries'
 * `completed` can be recomputed.
 */
function cleanSocialDays(
  challenges: Challenge[],
  rulesByChallenge: Map<number, Ruleset>,
  report: NormalizationReport,
): { challenges: Challenge[]; removedSocialDaysByChallenge: Map<number, Set<number>> } {
  const removedSocialDaysByChallenge = new Map<number, Set<number>>()

  const cleaned = challenges.map((challenge) => {
    if (!challenge.socialDays || challenge.socialDays.length === 0) return challenge

    const rules = rulesByChallenge.get(challenge.id)
    const kept = rules ? keepEarliestPerWeek(challenge.socialDays, rules.socialDaysPerWeek) : []
    const keptSet = new Set(kept)
    const removed = [...new Set(challenge.socialDays)].filter((d) => !keptSet.has(d))

    if (removed.length > 0) {
      removedSocialDaysByChallenge.set(challenge.id, new Set(removed))
      report.invalidFlagsCleared += removed.length
    }

    const next = { ...challenge, socialDays: kept.length > 0 ? kept : undefined }
    if (next.socialDays === undefined) delete next.socialDays
    return next
  })

  return { challenges: cleaned, removedSocialDaysByChallenge }
}

/** The sorted, de-duplicated days, keeping only the earliest in each challenge week. Empty when `perWeek` is 0. */
function keepEarliestPerWeek(days: number[], perWeek: number): number[] {
  if (perWeek === 0) return []
  const seenWeeks = new Set<number>()
  const kept: number[] = []
  for (const dayNumber of [...new Set(days)].sort((a, b) => a - b)) {
    const week = challengeWeek(dayNumber)
    if (seenWeeks.has(week)) continue
    seenWeeks.add(week)
    kept.push(dayNumber)
  }
  return kept
}

/**
 * Drops a day entry's `restDay` when its challenge's rules allow none, or
 * when an earlier-numbered entry of the same challenge already holds that
 * week's rest day. Returns the ids of entries that lost theirs, so their
 * `completed` can be recomputed.
 */
function cleanRestDays(
  dayEntries: DayEntry[],
  rulesByChallenge: Map<number, Ruleset>,
  report: NormalizationReport,
): { dayEntries: DayEntry[]; changedEntryIds: Set<number> } {
  const restDayEntries = dayEntries
    .filter((e) => e.restDay === true && isChallengeDay(e.dayNumber))
    .sort((a, b) => a.dayNumber - b.dayNumber)

  const keptIds = new Set<number>()
  const seenWeeksByChallenge = new Map<number, Set<number>>()
  for (const entry of restDayEntries) {
    const rules = rulesByChallenge.get(entry.challengeId)
    if (!rules || rules.restDaysPerWeek === 0) continue

    const seenWeeks = seenWeeksByChallenge.get(entry.challengeId) ?? new Set<number>()
    seenWeeksByChallenge.set(entry.challengeId, seenWeeks)

    const week = challengeWeek(entry.dayNumber)
    if (seenWeeks.has(week)) continue
    seenWeeks.add(week)
    keptIds.add(entry.id)
  }

  const changedEntryIds = new Set<number>()
  const cleaned = dayEntries.map((entry) => {
    if (entry.restDay !== true || keptIds.has(entry.id)) return entry
    changedEntryIds.add(entry.id)
    report.invalidFlagsCleared++
    const next = { ...entry }
    delete next.restDay
    return next
  })

  return { dayEntries: cleaned, changedEntryIds }
}

function normalizeChallenges(
  input: Challenge[],
  dayEntries: DayEntry[],
  today: string,
  report: NormalizationReport,
): Challenge[] {
  let challenges = input.map((challenge) => {
    if (isValidISODate(challenge.startDate)) return challenge
    const entryDates = dayEntries
      .filter((e) => e.challengeId === challenge.id && isValidISODate(e.date))
      .map((e) => e.date)
      .sort()
    report.startDatesRepaired++
    return { ...challenge, startDate: entryDates[0] ?? today }
  })

  const numbers = challenges.map((c) => c.attemptNumber)
  const attemptNumbersValid =
    numbers.every((n) => Number.isInteger(n) && n >= 1) && new Set(numbers).size === numbers.length
  if (!attemptNumbersValid) {
    const ordered = [...challenges].sort(
      (a, b) => (Number(a.attemptNumber) || 0) - (Number(b.attemptNumber) || 0) || a.id - b.id,
    )
    const renumbered = new Map(ordered.map((c, index) => [c.id, index + 1]))
    challenges = challenges.map((c) => {
      const attemptNumber = renumbered.get(c.id)!
      if (attemptNumber !== c.attemptNumber) report.attemptsRenumbered++
      return { ...c, attemptNumber }
    })
  }

  const active = challenges.filter((c) => c.status === 'active')
  if (active.length > 1) {
    const keep = active.reduce((latest, c) => (c.attemptNumber > latest.attemptNumber ? c : latest))
    challenges = challenges.map((c) => {
      if (c.status !== 'active' || c.id === keep.id) return c
      report.extraActiveChallengesArchived++
      return { ...c, status: 'failed' as const }
    })
  }

  return challenges
}

function mergeDuplicateDayEntries(
  dayEntries: DayEntry[],
  workouts: Workout[],
  rulesByChallenge: Map<number, Ruleset>,
  socialDaysByChallenge: Map<number, number[] | undefined>,
  report: NormalizationReport,
): { dayEntries: DayEntry[]; workouts: Workout[] } {
  const groups = new Map<string, DayEntry[]>()
  for (const entry of dayEntries) {
    if (!isChallengeDay(entry.dayNumber)) continue
    const key = `${entry.challengeId}:${entry.dayNumber}`
    groups.set(key, [...(groups.get(key) ?? []), entry])
  }

  const replacedBy = new Map<number, number>() // removed entry id → kept entry id
  const mergedEntries = new Map<number, DayEntry>()

  for (const group of groups.values()) {
    if (group.length < 2) continue
    const [kept, ...duplicates] = [...group].sort((a, b) => a.id - b.id)
    const all = [kept, ...duplicates]
    const notes = [...new Set(all.map((e) => e.notes?.trim()).filter((n): n is string => Boolean(n)))]

    const merged: DayEntry = {
      ...kept,
      water_ml: Math.max(...all.map((e) => e.water_ml || 0)),
      pages_read: Math.max(...all.map((e) => e.pages_read || 0)),
      dietFollowed: all.some((e) => e.dietFollowed),
      noAlcohol: all.some((e) => e.noAlcohol),
      photoId: all.find((e) => e.photoId != null)?.photoId,
      mood: all.find((e) => e.mood != null)?.mood,
      notes: notes.length > 0 ? notes.join('\n\n') : undefined,
    }
    if (merged.photoId === undefined) delete merged.photoId
    if (merged.mood === undefined) delete merged.mood
    if (merged.notes === undefined) delete merged.notes

    mergedEntries.set(kept.id, merged)
    for (const duplicate of duplicates) replacedBy.set(duplicate.id, kept.id)
    report.duplicateDayEntriesMerged += duplicates.length
  }

  if (replacedBy.size === 0) return { dayEntries, workouts }

  const nextWorkouts = workouts.map((w) =>
    replacedBy.has(w.dayEntryId) ? { ...w, dayEntryId: replacedBy.get(w.dayEntryId)! } : w,
  )

  const nextEntries = dayEntries
    .filter((e) => !replacedBy.has(e.id))
    .map((entry) => {
      const merged = mergedEntries.get(entry.id)
      if (!merged) return entry
      const entryWorkouts = nextWorkouts.filter((w) => w.dayEntryId === entry.id)
      const rules = rulesByChallenge.get(entry.challengeId) ?? RULESETS.hard
      const socialDays = socialDaysByChallenge.get(entry.challengeId)
      return { ...merged, completed: isDayComplete(toDayTaskData(merged, entryWorkouts, socialDays), rules) }
    })

  return { dayEntries: nextEntries, workouts: nextWorkouts }
}

function dedupeBadges(badges: Badge[], report: NormalizationReport): Badge[] {
  const earliest = new Map<string, Badge>()
  for (const badge of badges) {
    const key = `${badge.challengeId}:${badge.badgeId}`
    const current = earliest.get(key)
    const isEarlier =
      !current ||
      badge.unlockedAt < current.unlockedAt ||
      (badge.unlockedAt === current.unlockedAt && badge.id < current.id)
    if (isEarlier) earliest.set(key, badge)
  }
  const kept = new Set([...earliest.values()].map((b) => b.id))
  report.duplicateBadgesRemoved = badges.length - kept.size
  return badges.filter((b) => kept.has(b.id))
}

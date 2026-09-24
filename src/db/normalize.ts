import { dayNumberForDate, isValidISODate } from '../lib/dates'
import { isDayComplete } from '../logic/dayCompletion'
import { isChallengeDay } from '../logic/days'
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
}

/**
 * Repairs data written before the v3 schema's uniqueness rules existed (or
 * found in an old backup), so it can be stored under them:
 * - invalid start dates → the challenge's earliest entry date, else `today`;
 * - colliding or invalid attempt numbers → renumbered in their existing order;
 * - more than one active challenge → all but the latest archived as failed;
 * - invalid day numbers → recomputed from the entry's date;
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
  }

  const challenges = normalizeChallenges(records.challenges, records.dayEntries, today, report)
  const startDateById = new Map(challenges.map((c) => [c.id, c.startDate]))

  const dayEntries = records.dayEntries.map((entry) => {
    if (isChallengeDay(entry.dayNumber)) return entry
    const startDate = startDateById.get(entry.challengeId)
    const dayNumber = startDate ? dayNumberForDate(startDate, entry.date) : Number.NaN
    if (!isChallengeDay(dayNumber)) return entry // can't be placed; it simply stays unindexed
    report.dayNumbersRepaired++
    return { ...entry, dayNumber }
  })

  const merged = mergeDuplicateDayEntries(dayEntries, records.workouts, report)
  const badges = dedupeBadges(records.badges, report)

  return { challenges, dayEntries: merged.dayEntries, workouts: merged.workouts, badges, report }
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
      return { ...merged, completed: isDayComplete(toDayTaskData(merged, entryWorkouts)) }
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

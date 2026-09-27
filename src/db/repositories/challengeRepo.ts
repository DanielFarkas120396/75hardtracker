import { dayNumberForDate } from '../../lib/dates'
import { CHALLENGE_LENGTH } from '../../logic/constants'
import { buildNextChallenge } from '../../logic/restart'
import { RULESETS, challengeWeek, rulesFor, variantOf, type ChallengeVariant } from '../../logic/rulesets'
import { isStartDateEditable, validateStartDateChange, type StartDateChangeResult } from '../../logic/startDate'
import { COMPLETION_TABLES, syncDayCompletion } from '../completion'
import { db } from '../db'
import type { Challenge } from '../types'

export type SocialDayResult =
  | { ok: true }
  | { ok: false; reason: 'not-allowed' | 'too-late' | 'out-of-range' | 'week-taken'; dayNumber?: number }
export type VariantChangeResult = { ok: true } | { ok: false; reason: 'locked' }

/** Returns the active challenge's id, or creates the next attempt. Must run inside a rw transaction on challenges. */
async function activeOrNextAttempt(startDate: string, variant: ChallengeVariant): Promise<number> {
  const active = await db.challenges.where('status').equals('active').first()
  if (active) return active.id
  const all = await db.challenges.toArray()
  return db.challenges.add(buildNextChallenge(all.map((c) => c.attemptNumber), startDate, variant) as Challenge)
}

export const challengeRepo = {
  async getActiveChallenge(): Promise<Challenge | undefined> {
    return db.challenges.where('status').equals('active').first()
  },

  /** The active challenge or, when none is active, the most recent attempt (completed or failed). */
  async getCurrent(): Promise<Challenge | undefined> {
    const active = await db.challenges.where('status').equals('active').first()
    return active ?? db.challenges.orderBy('attemptNumber').last()
  },

  async getById(id: number): Promise<Challenge | undefined> {
    return db.challenges.get(id)
  },

  async getAll(): Promise<Challenge[]> {
    return db.challenges.orderBy('attemptNumber').toArray()
  },

  /**
   * Creates attempt #1 on first launch — only when there are no challenges
   * at all. The emptiness check and the insert share one transaction, so
   * concurrent calls (StrictMode, two tabs) can't create two.
   */
  async bootstrapIfEmpty(startDate: string): Promise<void> {
    await db.transaction('rw', db.challenges, async () => {
      if ((await db.challenges.count()) > 0) return
      await db.challenges.add(buildNextChallenge([], startDate, 'hard') as Challenge)
    })
  },

  /**
   * Archives an attempt as `failed` and starts the next one (attempt number
   * = highest + 1) in a single transaction, keeping the failed attempt's
   * variant (75 Hard if it had none). If an active attempt already exists —
   * e.g. the restart button was tapped twice — it's reused, so there's never
   * more than one active challenge. Only the old row's `status` is touched.
   */
  async restart(failedChallengeId: number, startDate: string): Promise<number> {
    return db.transaction('rw', db.challenges, async () => {
      const failed = await db.challenges.get(failedChallengeId)
      if (failed?.status === 'active') {
        await db.challenges.update(failedChallengeId, { status: 'failed' })
      }
      return activeOrNextAttempt(startDate, variantOf(failed ?? {}))
    })
  },

  /** Starts a fresh attempt after a completed one. Reuses the active attempt if one already exists. */
  async startNew(startDate: string, variant: ChallengeVariant): Promise<number> {
    return db.transaction('rw', db.challenges, () => activeOrNextAttempt(startDate, variant))
  },

  /** Marks an active attempt as completed. A no-op for attempts that aren't active. */
  async markCompleted(id: number): Promise<void> {
    await db.challenges
      .where('id')
      .equals(id)
      .modify((challenge) => {
        if (challenge.status === 'active') challenge.status = 'completed'
      })
  },

  /**
   * Moves an active attempt's start date (today or later, pre-start or on
   * Day 1 only — see validateStartDateChange). Whatever was logged under
   * the old start no longer belongs to the attempt, so its day entries,
   * workouts, photos and badges are removed in the same transaction; the UI
   * asks for confirmation first whenever that includes real progress.
   */
  async changeStartDate(id: number, newStartDate: string, today: string): Promise<StartDateChangeResult> {
    return db.transaction('rw', [db.challenges, db.dayEntries, db.workouts, db.photos, db.badges], async () => {
      const challenge = await db.challenges.get(id)
      if (!challenge || challenge.status !== 'active') return { ok: false, reason: 'locked' } as const

      const result = validateStartDateChange({
        proposed: newStartDate,
        today,
        todayDayNumber: dayNumberForDate(challenge.startDate, today),
      })
      if (!result.ok || newStartDate === challenge.startDate) return result

      const entries = await db.dayEntries.where('challengeId').equals(id).toArray()
      const entryIds = entries.map((e) => e.id)
      if (entryIds.length > 0) {
        await db.workouts.where('dayEntryId').anyOf(entryIds).delete()
      }
      await db.photos.bulkDelete(entries.flatMap((e) => (e.photoId != null ? [e.photoId] : [])))
      await db.dayEntries.bulkDelete(entryIds)
      await db.badges.where('challengeId').equals(id).delete()
      await db.challenges.update(id, { startDate: newStartDate })
      return result
    })
  },

  /**
   * Switches an active attempt's challenge while its start date can still move
   * (before or on Day 1). Social occasions and recovery days the new rules
   * don't allow are cleared, and the attempt's days are re-judged.
   */
  async changeVariant(id: number, variant: ChallengeVariant, today: string): Promise<VariantChangeResult> {
    return db.transaction('rw', COMPLETION_TABLES, async () => {
      const challenge = await db.challenges.get(id)
      if (!challenge || challenge.status !== 'active') return { ok: false, reason: 'locked' } as const
      if (!isStartDateEditable(dayNumberForDate(challenge.startDate, today))) return { ok: false, reason: 'locked' } as const

      const rules = RULESETS[variant]
      await db.challenges.update(id, {
        variant,
        ...(rules.socialDaysPerWeek === 0 ? { socialDays: undefined } : {}),
      })
      const entries = await db.dayEntries.where('challengeId').equals(id).toArray()
      for (const entry of entries) {
        if (rules.restDaysPerWeek === 0 && entry.restDay) await db.dayEntries.update(entry.id, { restDay: undefined })
        await syncDayCompletion(entry.id)
      }
      return { ok: true } as const
    })
  },

  /**
   * Declares (or cancels) a social occasion. It must be declared the day
   * before at the latest, with at most one per challenge week, and only in
   * challenges that allow them. A past occasion can't be cancelled; cancelling
   * today's re-judges today.
   */
  async setSocialDay(id: number, dayNumber: number, on: boolean, today: string): Promise<SocialDayResult> {
    return db.transaction('rw', COMPLETION_TABLES, async () => {
      const challenge = await db.challenges.get(id)
      if (!challenge || challenge.status !== 'active' || rulesFor(challenge).socialDaysPerWeek === 0) {
        return { ok: false, reason: 'not-allowed' } as const
      }
      if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > CHALLENGE_LENGTH) {
        return { ok: false, reason: 'out-of-range' } as const
      }
      const todayDayNumber = dayNumberForDate(challenge.startDate, today)
      const days = challenge.socialDays ?? []

      if (on) {
        if (!(dayNumber > todayDayNumber)) return { ok: false, reason: 'too-late' } as const
        if (days.includes(dayNumber)) return { ok: true } as const
        const taken = days.find((d) => challengeWeek(d) === challengeWeek(dayNumber))
        if (taken !== undefined) return { ok: false, reason: 'week-taken', dayNumber: taken } as const
        await db.challenges.update(id, { socialDays: [...days, dayNumber].sort((a, b) => a - b) })
        return { ok: true } as const
      }

      if (!days.includes(dayNumber)) return { ok: true } as const
      if (dayNumber < todayDayNumber) return { ok: false, reason: 'too-late' } as const
      const rest = days.filter((d) => d !== dayNumber)
      await db.challenges.update(id, { socialDays: rest.length > 0 ? rest : undefined })
      if (dayNumber === todayDayNumber) {
        const entry = await db.dayEntries.where('[challengeId+dayNumber]').equals([id, dayNumber]).first()
        if (entry) await syncDayCompletion(entry.id)
      }
      return { ok: true } as const
    })
  },

  /** Records that the player has seen `count` used jokers announced. Never lowers the count. */
  async acknowledgeJokers(id: number, count: number): Promise<void> {
    await db.challenges
      .where('id')
      .equals(id)
      .modify((challenge) => {
        if (count > (challenge.jokersAcknowledged ?? 0)) challenge.jokersAcknowledged = count
      })
  },
}

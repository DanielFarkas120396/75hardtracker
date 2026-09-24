import { dayNumberForDate } from '../../lib/dates'
import { buildNextChallenge } from '../../logic/restart'
import { validateStartDateChange, type StartDateChangeResult } from '../../logic/startDate'
import { db } from '../db'
import type { Challenge } from '../types'

/** Returns the active challenge's id, or creates the next attempt. Must run inside a rw transaction on challenges. */
async function activeOrNextAttempt(startDate: string): Promise<number> {
  const active = await db.challenges.where('status').equals('active').first()
  if (active) return active.id

  const all = await db.challenges.toArray()
  const next = buildNextChallenge(
    all.map((c) => c.attemptNumber),
    startDate,
  )
  return db.challenges.add(next as Challenge)
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
      await db.challenges.add(buildNextChallenge([], startDate) as Challenge)
    })
  },

  /**
   * Archives an attempt as `failed` and starts the next one (attempt number
   * = highest + 1) in a single transaction. If an active attempt already
   * exists — e.g. the restart button was tapped twice — it's reused, so
   * there's never more than one active challenge.
   */
  async restart(failedChallengeId: number, startDate: string): Promise<number> {
    return db.transaction('rw', db.challenges, async () => {
      const failed = await db.challenges.get(failedChallengeId)
      if (failed?.status === 'active') {
        await db.challenges.update(failedChallengeId, { status: 'failed' })
      }
      return activeOrNextAttempt(startDate)
    })
  },

  /** Starts a fresh attempt after a completed one. Reuses the active attempt if one already exists. */
  async startNew(startDate: string): Promise<number> {
    return db.transaction('rw', db.challenges, () => activeOrNextAttempt(startDate))
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
}

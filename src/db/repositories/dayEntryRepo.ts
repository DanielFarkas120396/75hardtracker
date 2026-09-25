import { hasAnyProgress, TASK_IDS } from '../../logic/dayCompletion'
import { isChallengeDay } from '../../logic/days'
import { parseHHmm } from '../../logic/menace'
import type { TaskId } from '../../logic/types'
import { syncDayCompletion } from '../completion'
import { db } from '../db'
import { groupWorkoutsByEntry, toDayTaskData } from '../mappers'
import type { DayEntry } from '../types'

/** Runs a change to one DayEntry and re-syncs its `completed` flag, atomically. */
function changeAndSync(entryId: number, change: () => Promise<unknown>): Promise<void> {
  return db.transaction('rw', db.dayEntries, db.workouts, async () => {
    await change()
    await syncDayCompletion(entryId)
  })
}

export const dayEntryRepo = {
  async getByChallengeAndDayNumber(challengeId: number, dayNumber: number): Promise<DayEntry | undefined> {
    if (!isChallengeDay(dayNumber)) return undefined
    return db.dayEntries.where('[challengeId+dayNumber]').equals([challengeId, dayNumber]).first()
  },

  async getAllForChallenge(challengeId: number): Promise<DayEntry[]> {
    return db.dayEntries.where('challengeId').equals(challengeId).sortBy('dayNumber')
  },

  /** Every DayEntry of the given challenges, in one query. */
  async getAllForChallenges(challengeIds: number[]): Promise<DayEntry[]> {
    if (challengeIds.length === 0) return []
    return db.dayEntries.where('challengeId').anyOf(challengeIds).toArray()
  },

  /** Every DayEntry with a photo attached, across all challenges/attempts — for the Gallery. */
  async getAllWithPhoto(): Promise<DayEntry[]> {
    return db.dayEntries.filter((e) => e.photoId != null).toArray()
  },

  /**
   * The entry for a challenge day, created if missing. The lookup and the
   * insert share one read-write transaction — IndexedDB runs those one at a
   * time — so concurrent calls (StrictMode's double effects, quick
   * re-renders) can never create two entries for the same day; the unique
   * [challengeId+dayNumber] index backs that up.
   */
  async getOrCreate(params: { challengeId: number; dayNumber: number; date: string }): Promise<DayEntry> {
    if (!isChallengeDay(params.dayNumber)) {
      throw new RangeError(`Day ${params.dayNumber} is outside the challenge`)
    }

    try {
      return await db.transaction('rw', db.dayEntries, async () => {
        const existing = await dayEntryRepo.getByChallengeAndDayNumber(params.challengeId, params.dayNumber)
        if (existing) return existing

        const fresh: Omit<DayEntry, 'id'> = {
          challengeId: params.challengeId,
          date: params.date,
          dayNumber: params.dayNumber,
          water_ml: 0,
          pages_read: 0,
          dietFollowed: false,
          noAlcohol: false,
          completed: false,
        }
        const id = await db.dayEntries.add(fresh as DayEntry)
        return { ...fresh, id }
      })
    } catch (error) {
      // Another connection (a second tab) won the race: use its entry.
      const existing =
        error instanceof Error && error.name === 'ConstraintError'
          ? await dayEntryRepo.getByChallengeAndDayNumber(params.challengeId, params.dayNumber)
          : undefined
      if (existing) return existing
      throw error
    }
  },

  /** Whether anything at all has been logged in this attempt (tasks, mood or notes). */
  async hasLoggedProgress(challengeId: number): Promise<boolean> {
    const entries = await db.dayEntries.where('challengeId').equals(challengeId).toArray()
    if (entries.length === 0) return false
    const workoutsByEntry = groupWorkoutsByEntry(
      await db.workouts
        .where('dayEntryId')
        .anyOf(entries.map((e) => e.id))
        .toArray(),
    )
    return entries.some(
      (entry) =>
        hasAnyProgress(toDayTaskData(entry, workoutsByEntry.get(entry.id) ?? [])) ||
        entry.mood != null ||
        Boolean(entry.notes?.trim()),
    )
  },

  async update(id: number, changes: Partial<DayEntry>): Promise<void> {
    await changeAndSync(id, () => db.dayEntries.update(id, changes))
  },

  /** Replaces the day's plan; an empty plan removes the field. Plans never affect completion, so there's no re-sync. */
  async setPlans(id: number, plans: Partial<Record<TaskId, string>>): Promise<void> {
    const cleaned: Partial<Record<TaskId, string>> = {}
    for (const task of TASK_IDS) {
      const time = plans[task]
      if (time !== undefined && parseHHmm(time) !== null) cleaned[task] = time
    }
    await db.dayEntries.update(id, { plans: Object.keys(cleaned).length > 0 ? cleaned : undefined })
  },

  /** Atomically adjusts water_ml by a signed delta, clamped at 0 — safe under rapid quick-add taps. */
  async adjustWater(id: number, deltaMl: number): Promise<void> {
    await changeAndSync(id, () =>
      db.dayEntries
        .where('id')
        .equals(id)
        .modify((entry) => {
          entry.water_ml = Math.max(0, entry.water_ml + deltaMl)
        }),
    )
  },

  /** Atomically adjusts pages_read by a signed delta, clamped at 0 — safe under rapid stepper taps. */
  async adjustPages(id: number, deltaPages: number): Promise<void> {
    await changeAndSync(id, () =>
      db.dayEntries
        .where('id')
        .equals(id)
        .modify((entry) => {
          entry.pages_read = Math.max(0, entry.pages_read + deltaPages)
        }),
    )
  },
}

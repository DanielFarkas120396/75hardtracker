import { hasAnyProgress, TASK_IDS } from '@logic/dayCompletion'
import { isChallengeDay } from '@logic/days'
import { groupWorkoutsByEntry, toDayTaskData } from '@logic/mappers'
import { parseHHmm } from '@logic/menace'
import { challengeWeek, rulesFor } from '@logic/rulesets'
import type { TaskId } from '@logic/types'
import { syncDayCompletion } from '../completion'
import type { Db } from '../driver'
import { getDb, transaction } from '../open'
import { allRows, getRow, insertRow, updateRow } from '../table'
import type { DayEntry } from '../types'

export type RestDayResult = { ok: true } | { ok: false; reason: 'not-allowed' | 'week-taken'; dayNumber?: number }

/** Runs a change to one day entry and re-syncs its `completed` flag, in one transaction. */
function changeAndSync(entryId: number, change: (db: Db) => Promise<unknown>): Promise<void> {
  return transaction(async (db) => {
    await change(db)
    await syncDayCompletion(db, entryId)
  })
}

async function byChallengeAndDayNumber(db: Db, challengeId: number, dayNumber: number): Promise<DayEntry | undefined> {
  if (!isChallengeDay(dayNumber)) return undefined
  return (await allRows(db, 'dayEntries', 'WHERE challengeId = ? AND dayNumber = ?', [challengeId, dayNumber]))[0]
}

const marks = (ids: number[]) => ids.map(() => '?').join(', ')

/** The days of an attempt. Same calls and behaviour as the web app's dayEntryRepo (src/db/repositories/dayEntryRepo.ts). */
export const dayEntryRepo = {
  async getByChallengeAndDayNumber(challengeId: number, dayNumber: number): Promise<DayEntry | undefined> {
    return byChallengeAndDayNumber(getDb(), challengeId, dayNumber)
  },

  async getAllForChallenge(challengeId: number): Promise<DayEntry[]> {
    return allRows(getDb(), 'dayEntries', 'WHERE challengeId = ? ORDER BY dayNumber', [challengeId])
  },

  /** Every day entry of the given challenges, in one query. */
  async getAllForChallenges(challengeIds: number[]): Promise<DayEntry[]> {
    if (challengeIds.length === 0) return []
    return allRows(getDb(), 'dayEntries', `WHERE challengeId IN (${marks(challengeIds)})`, challengeIds)
  },

  /** Every day entry with a photo attached, across all attempts: for the Gallery. */
  async getAllWithPhoto(): Promise<DayEntry[]> {
    return allRows(getDb(), 'dayEntries', 'WHERE photoId IS NOT NULL')
  },

  /**
   * The entry for a challenge day, created if missing. The lookup and the
   * insert share one transaction, and transactions run one at a time, so
   * concurrent calls can never create two entries for the same day; the
   * UNIQUE (challengeId, dayNumber) backs that up.
   */
  async getOrCreate(params: { challengeId: number; dayNumber: number; date: string }): Promise<DayEntry> {
    if (!isChallengeDay(params.dayNumber)) {
      throw new RangeError(`Day ${params.dayNumber} is outside the challenge`)
    }
    return transaction(async (db) => {
      const existing = await byChallengeAndDayNumber(db, params.challengeId, params.dayNumber)
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
      return { ...fresh, id: await insertRow(db, 'dayEntries', fresh) }
    })
  },

  /** Whether anything at all has been logged in this attempt (tasks, mood or notes). */
  async hasLoggedProgress(challengeId: number): Promise<boolean> {
    const db = getDb()
    const entries = await allRows(db, 'dayEntries', 'WHERE challengeId = ?', [challengeId])
    if (entries.length === 0) return false
    const ids = entries.map((entry) => entry.id)
    const workoutsByEntry = groupWorkoutsByEntry(await allRows(db, 'workouts', `WHERE dayEntryId IN (${marks(ids)})`, ids))
    return entries.some(
      (entry) =>
        hasAnyProgress(toDayTaskData(entry, workoutsByEntry.get(entry.id) ?? [], undefined)) ||
        entry.mood != null ||
        Boolean(entry.notes?.trim()),
    )
  },

  async update(id: number, changes: Partial<Omit<DayEntry, 'id'>>): Promise<void> {
    await changeAndSync(id, (db) => updateRow(db, 'dayEntries', id, changes))
  },

  /** Records the book the day's pages went to. It plays no part in completing the day, so nothing is recomputed. */
  async setBook(id: number, bookId: number): Promise<void> {
    await transaction((db) => updateRow(db, 'dayEntries', id, { bookId }))
  },

  /**
   * Replaces the day's plan and the per-task estimate frozen at save time;
   * an empty plan removes both fields. An estimate is kept only for a task
   * that's also in the cleaned plan, and only if it's a finite number >= 0.
   * Plans never affect completion, so there's no re-sync.
   */
  async setPlans(
    id: number,
    plans: Partial<Record<TaskId, string>>,
    estimates: Partial<Record<TaskId, number>> = {},
  ): Promise<void> {
    const cleaned: Partial<Record<TaskId, string>> = {}
    for (const task of TASK_IDS) {
      const time = plans[task]
      if (time !== undefined && parseHHmm(time) !== null) cleaned[task] = time
    }
    const cleanedEstimates: Partial<Record<TaskId, number>> = {}
    for (const task of TASK_IDS) {
      const estimate = estimates[task]
      if (cleaned[task] !== undefined && typeof estimate === 'number' && Number.isFinite(estimate) && estimate >= 0) {
        cleanedEstimates[task] = estimate
      }
    }
    await transaction((db) =>
      updateRow(db, 'dayEntries', id, {
        plans: Object.keys(cleaned).length > 0 ? cleaned : undefined,
        planEstimates: Object.keys(cleanedEstimates).length > 0 ? cleanedEstimates : undefined,
      }),
    )
  },

  /** Adjusts water_ml by a signed amount, never below 0, in one statement: safe under quick taps. */
  async adjustWater(id: number, deltaMl: number): Promise<void> {
    await changeAndSync(id, (db) =>
      db.runAsync('UPDATE dayEntries SET water_ml = MAX(0, water_ml + ?) WHERE id = ?', [deltaMl, id]),
    )
  },

  /** Adjusts pages_read by a signed amount, never below 0, in one statement: safe under quick taps. */
  async adjustPages(id: number, deltaPages: number): Promise<void> {
    await changeAndSync(id, (db) =>
      db.runAsync('UPDATE dayEntries SET pages_read = MAX(0, pages_read + ?) WHERE id = ?', [deltaPages, id]),
    )
  },

  /**
   * Takes (or gives back) 75 Soft's recovery day on this entry: at most one
   * per challenge week, and only in challenges that allow one. The workouts
   * task counts as done that day.
   */
  async setRestDay(entryId: number, on: boolean): Promise<RestDayResult> {
    return transaction(async (db): Promise<RestDayResult> => {
      const entry = await getRow(db, 'dayEntries', entryId)
      if (!entry) return { ok: false, reason: 'not-allowed' }
      const challenge = await getRow(db, 'challenges', entry.challengeId)
      if (rulesFor(challenge ?? {}).restDaysPerWeek === 0) return { ok: false, reason: 'not-allowed' }

      if (on) {
        const siblings = await allRows(db, 'dayEntries', 'WHERE challengeId = ?', [entry.challengeId])
        const taken = siblings.find(
          (e) => e.id !== entry.id && e.restDay && challengeWeek(e.dayNumber) === challengeWeek(entry.dayNumber),
        )
        if (taken) return { ok: false, reason: 'week-taken', dayNumber: taken.dayNumber }
      }
      await updateRow(db, 'dayEntries', entryId, { restDay: on ? true : undefined })
      await syncDayCompletion(db, entryId)
      return { ok: true }
    })
  },
}

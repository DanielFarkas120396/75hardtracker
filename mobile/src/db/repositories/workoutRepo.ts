import { syncDayCompletion } from '../completion'
import type { Db } from '../driver'
import { getDb, transaction } from '../open'
import { allRows, getRow, insertRow, updateRow } from '../table'
import type { Workout } from '../types'

/** Runs a change addressed by workout id and re-syncs its day's `completed` flag, in one transaction. */
function changeWorkoutAndSync(id: number, change: (db: Db) => Promise<unknown>): Promise<void> {
  return transaction(async (db) => {
    const workout = await getRow(db, 'workouts', id)
    if (!workout) return
    await change(db)
    await syncDayCompletion(db, workout.dayEntryId)
  })
}

/** A day's workouts. Same calls and behaviour as the web app's workoutRepo (src/db/repositories/workoutRepo.ts). */
export const workoutRepo = {
  async getForDayEntry(dayEntryId: number): Promise<Workout[]> {
    return allRows(getDb(), 'workouts', 'WHERE dayEntryId = ?', [dayEntryId])
  },

  /** All workouts for many day entries in one query. */
  async getForDayEntries(dayEntryIds: number[]): Promise<Workout[]> {
    if (dayEntryIds.length === 0) return []
    return allRows(getDb(), 'workouts', `WHERE dayEntryId IN (${dayEntryIds.map(() => '?').join(', ')})`, dayEntryIds)
  },

  async add(workout: Omit<Workout, 'id'>): Promise<number> {
    return transaction(async (db) => {
      const id = await insertRow(db, 'workouts', workout)
      await syncDayCompletion(db, workout.dayEntryId)
      return id
    })
  },

  async update(id: number, changes: Partial<Omit<Workout, 'id' | 'dayEntryId'>>): Promise<void> {
    await changeWorkoutAndSync(id, (db) => updateRow(db, 'workouts', id, changes))
  },

  /** Adjusts durationMin by a signed amount, kept within [min, max], in one statement: safe under quick taps. */
  async adjustDuration(id: number, deltaMin: number, min: number, max: number): Promise<void> {
    await changeWorkoutAndSync(id, (db) =>
      db.runAsync('UPDATE workouts SET durationMin = MIN(?, MAX(?, durationMin + ?)) WHERE id = ?', [max, min, deltaMin, id]),
    )
  },

  async remove(id: number): Promise<void> {
    await changeWorkoutAndSync(id, (db) => db.runAsync('DELETE FROM workouts WHERE id = ?', [id]))
  },
}

import { syncDayCompletion } from '../completion'
import { db } from '../db'
import type { Workout } from '../types'

/** Runs a change to a DayEntry's workouts and re-syncs the entry's `completed` flag, atomically. */
function changeAndSync<T>(dayEntryId: number, change: () => Promise<T>): Promise<T> {
  return db.transaction('rw', db.dayEntries, db.workouts, async () => {
    const result = await change()
    await syncDayCompletion(dayEntryId)
    return result
  })
}

/** Like changeAndSync, for a change addressed by workout id. */
function changeWorkoutAndSync(id: number, change: () => Promise<unknown>): Promise<void> {
  return db.transaction('rw', db.dayEntries, db.workouts, async () => {
    const workout = await db.workouts.get(id)
    if (!workout) return
    await change()
    await syncDayCompletion(workout.dayEntryId)
  })
}

export const workoutRepo = {
  async getForDayEntry(dayEntryId: number): Promise<Workout[]> {
    return db.workouts.where('dayEntryId').equals(dayEntryId).toArray()
  },

  /** All workouts for many DayEntries in one query. */
  async getForDayEntries(dayEntryIds: number[]): Promise<Workout[]> {
    if (dayEntryIds.length === 0) return []
    return db.workouts.where('dayEntryId').anyOf(dayEntryIds).toArray()
  },

  async add(workout: Omit<Workout, 'id'>): Promise<number> {
    return changeAndSync(workout.dayEntryId, () => db.workouts.add(workout as Workout))
  },

  async update(id: number, changes: Partial<Omit<Workout, 'id' | 'dayEntryId'>>): Promise<void> {
    await changeWorkoutAndSync(id, () => db.workouts.update(id, changes))
  },

  /** Atomically adjusts durationMin by a signed delta, clamped to [min, max] — safe under rapid stepper taps. */
  async adjustDuration(id: number, deltaMin: number, min: number, max: number): Promise<void> {
    await changeWorkoutAndSync(id, () =>
      db.workouts
        .where('id')
        .equals(id)
        .modify((workout) => {
          workout.durationMin = Math.min(max, Math.max(min, workout.durationMin + deltaMin))
        }),
    )
  },

  async remove(id: number): Promise<void> {
    await changeWorkoutAndSync(id, () => db.workouts.delete(id))
  },
}

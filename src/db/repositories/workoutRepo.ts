import { db } from '../db'
import type { Workout } from '../types'

export const workoutRepo = {
  async getForDayEntry(dayEntryId: number): Promise<Workout[]> {
    return db.workouts.where('dayEntryId').equals(dayEntryId).toArray()
  },

  async add(workout: Omit<Workout, 'id'>): Promise<number> {
    return db.workouts.add(workout as Workout)
  },

  async update(id: number, changes: Partial<Workout>): Promise<void> {
    await db.workouts.update(id, changes)
  },

  /** Atomically adjusts durationMin by a signed delta, clamped to [min, max] — safe under rapid stepper taps. */
  async adjustDuration(id: number, deltaMin: number, min: number, max: number): Promise<void> {
    await db.workouts.where('id').equals(id).modify((workout) => {
      workout.durationMin = Math.min(max, Math.max(min, workout.durationMin + deltaMin))
    })
  },

  async remove(id: number): Promise<void> {
    await db.workouts.delete(id)
  },
}

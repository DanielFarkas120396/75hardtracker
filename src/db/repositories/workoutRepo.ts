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

  async remove(id: number): Promise<void> {
    await db.workouts.delete(id)
  },
}

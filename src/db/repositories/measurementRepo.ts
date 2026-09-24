import { db } from '../db'
import type { Measurement } from '../types'

export const measurementRepo = {
  async getAll(): Promise<Measurement[]> {
    return db.measurements.orderBy('date').toArray()
  },

  async add(measurement: Omit<Measurement, 'id'>): Promise<number> {
    return db.measurements.add(measurement as Measurement)
  },

  async update(id: number, changes: Partial<Measurement>): Promise<void> {
    await db.measurements.update(id, changes)
  },

  async remove(id: number): Promise<void> {
    await db.measurements.delete(id)
  },
}

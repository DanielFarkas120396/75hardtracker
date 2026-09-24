import type { ValidMeasurement } from '../../logic/measurements'
import { db } from '../db'
import type { Measurement } from '../types'

export type SaveMeasurementResult = { ok: true; id: number } | { ok: false; reason: 'dateTaken' }

export const measurementRepo = {
  async getAll(): Promise<Measurement[]> {
    return db.measurements.orderBy('date').toArray()
  },

  /**
   * Saves a weigh-in, one per date. A new entry (`id` undefined) on a date
   * that already has one replaces that day's values; editing an entry onto
   * another entry's date is refused rather than silently merging the two.
   */
  async save(value: ValidMeasurement, id?: number): Promise<SaveMeasurementResult> {
    return db.transaction('rw', db.measurements, async () => {
      const sameDate = await db.measurements.where('date').equals(value.date).first()
      const row = {
        date: value.date,
        weight_kg: value.weight_kg,
        bodyMeasurements_cm: value.bodyMeasurements_cm,
      }

      if (id === undefined) {
        if (sameDate) {
          await db.measurements.put({ ...row, id: sameDate.id })
          return { ok: true, id: sameDate.id }
        }
        return { ok: true, id: await db.measurements.add(row as Measurement) }
      }

      if (sameDate && sameDate.id !== id) return { ok: false, reason: 'dateTaken' }
      await db.measurements.put({ ...row, id })
      return { ok: true, id }
    })
  },

  async remove(id: number): Promise<void> {
    await db.measurements.delete(id)
  },
}

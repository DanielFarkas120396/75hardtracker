import type { ValidMeasurement } from '@logic/measurements'
import { getDb, transaction } from '../open'
import { allRows, insertRow, updateRow } from '../table'
import type { Measurement } from '../types'

export type SaveMeasurementResult = { ok: true; id: number } | { ok: false; reason: 'dateTaken' }

/** The weigh-ins. Same calls and behaviour as the web app's measurementRepo (src/db/repositories/measurementRepo.ts). */
export const measurementRepo = {
  async getAll(): Promise<Measurement[]> {
    return allRows(getDb(), 'measurements', 'ORDER BY date')
  },

  async getByDate(date: string): Promise<Measurement | undefined> {
    return (await allRows(getDb(), 'measurements', 'WHERE date = ? LIMIT 1', [date]))[0]
  },

  /** The most recent weight logged. */
  async getLatestWeight(): Promise<number | undefined> {
    const latest = await allRows(getDb(), 'measurements', 'WHERE weight_kg IS NOT NULL ORDER BY date DESC LIMIT 1')
    return latest[0]?.weight_kg
  },

  /**
   * Saves a weigh-in, one per date. A new entry (`id` undefined) on a date
   * that already has one replaces that day's values; editing an entry onto
   * another entry's date is refused rather than silently merging the two.
   */
  async save(value: ValidMeasurement, id?: number): Promise<SaveMeasurementResult> {
    return transaction(async (db): Promise<SaveMeasurementResult> => {
      const sameDate = (await allRows(db, 'measurements', 'WHERE date = ? LIMIT 1', [value.date]))[0]
      const row = { date: value.date, weight_kg: value.weight_kg, bodyMeasurements_cm: value.bodyMeasurements_cm }

      if (id === undefined && !sameDate) return { ok: true, id: await insertRow(db, 'measurements', row) }
      if (id !== undefined && sameDate && sameDate.id !== id) return { ok: false, reason: 'dateTaken' }
      const target = id ?? sameDate!.id
      await updateRow(db, 'measurements', target, row)
      return { ok: true, id: target }
    })
  },

  async remove(id: number): Promise<void> {
    await transaction((db) => db.runAsync('DELETE FROM measurements WHERE id = ?', [id]))
  },
}

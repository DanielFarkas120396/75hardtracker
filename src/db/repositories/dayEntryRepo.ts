import { db } from '../db'
import type { DayEntry } from '../types'

export const dayEntryRepo = {
  async getByChallengeAndDayNumber(challengeId: number, dayNumber: number): Promise<DayEntry | undefined> {
    return db.dayEntries.where('[challengeId+dayNumber]').equals([challengeId, dayNumber]).first()
  },

  async getAllForChallenge(challengeId: number): Promise<DayEntry[]> {
    return db.dayEntries.where('challengeId').equals(challengeId).sortBy('dayNumber')
  },

  /** Every DayEntry with a photo attached, across all challenges/attempts — for the Gallery. */
  async getAllWithPhoto(): Promise<DayEntry[]> {
    return db.dayEntries.filter((e) => e.photoId != null).toArray()
  },

  async getOrCreate(params: { challengeId: number; dayNumber: number; date: string }): Promise<DayEntry> {
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
  },

  async update(id: number, changes: Partial<DayEntry>): Promise<void> {
    await db.dayEntries.update(id, changes)
  },

  /** Atomically adjusts water_ml by a signed delta, clamped at 0 — safe under rapid quick-add taps. */
  async adjustWater(id: number, deltaMl: number): Promise<void> {
    await db.dayEntries.where('id').equals(id).modify((entry) => {
      entry.water_ml = Math.max(0, entry.water_ml + deltaMl)
    })
  },

  /** Atomically adjusts pages_read by a signed delta, clamped at 0 — safe under rapid stepper taps. */
  async adjustPages(id: number, deltaPages: number): Promise<void> {
    await db.dayEntries.where('id').equals(id).modify((entry) => {
      entry.pages_read = Math.max(0, entry.pages_read + deltaPages)
    })
  },
}

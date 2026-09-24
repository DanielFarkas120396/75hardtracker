import { db } from '../db'
import type { DayEntry } from '../types'

export const dayEntryRepo = {
  async getByChallengeAndDayNumber(challengeId: number, dayNumber: number): Promise<DayEntry | undefined> {
    return db.dayEntries.where('[challengeId+dayNumber]').equals([challengeId, dayNumber]).first()
  },

  async getAllForChallenge(challengeId: number): Promise<DayEntry[]> {
    return db.dayEntries.where('challengeId').equals(challengeId).sortBy('dayNumber')
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
}

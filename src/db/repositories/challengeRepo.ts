import { db } from '../db'
import type { Challenge, ChallengeStatus } from '../types'

export const challengeRepo = {
  async getActiveChallenge(): Promise<Challenge | undefined> {
    return db.challenges.where('status').equals('active').first()
  },

  async getById(id: number): Promise<Challenge | undefined> {
    return db.challenges.get(id)
  },

  async getAll(): Promise<Challenge[]> {
    return db.challenges.orderBy('attemptNumber').toArray()
  },

  async create(challenge: Omit<Challenge, 'id'>): Promise<number> {
    return db.challenges.add(challenge as Challenge)
  },

  async updateStatus(id: number, status: ChallengeStatus): Promise<void> {
    await db.challenges.update(id, { status })
  },

  async update(id: number, changes: Partial<Challenge>): Promise<void> {
    await db.challenges.update(id, changes)
  },

  /**
   * Archives the current challenge as `failed` and creates the restarted
   * one in a single transaction, so no other query can ever observe a
   * moment with zero active challenges (which would otherwise race with
   * useActiveChallenge's "bootstrap a new one" effect).
   */
  async restart(oldChallengeId: number, restarted: Omit<Challenge, 'id'>): Promise<number> {
    return db.transaction('rw', db.challenges, async () => {
      await db.challenges.update(oldChallengeId, { status: 'failed' })
      return db.challenges.add(restarted as Challenge)
    })
  },
}

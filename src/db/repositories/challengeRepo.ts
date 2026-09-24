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
}

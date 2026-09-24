import { db } from '../db'
import type { Badge } from '../types'

export const badgeRepo = {
  async getForChallenge(challengeId: number): Promise<Badge[]> {
    return db.badges.where('challengeId').equals(challengeId).toArray()
  },

  async unlock(badge: Omit<Badge, 'id'>): Promise<number> {
    return db.badges.add(badge as Badge)
  },
}

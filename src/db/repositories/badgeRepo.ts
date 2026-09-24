import { db } from '../db'
import type { Badge } from '../types'

export const badgeRepo = {
  async getForChallenge(challengeId: number): Promise<Badge[]> {
    return db.badges.where('challengeId').equals(challengeId).toArray()
  },

  /**
   * Unlocks each of `badgeIds` for the challenge unless it's already
   * unlocked, in one transaction. Returns only the ids actually added, so
   * concurrent evaluations never double-unlock (or double-toast) a badge.
   */
  async unlockMissing(challengeId: number, badgeIds: string[]): Promise<string[]> {
    if (badgeIds.length === 0) return []
    return db.transaction('rw', db.badges, async () => {
      const existing = await db.badges.where('challengeId').equals(challengeId).toArray()
      const unlocked = new Set(existing.map((b) => b.badgeId))
      const toAdd = [...new Set(badgeIds)].filter((id) => !unlocked.has(id))
      const unlockedAt = new Date().toISOString()
      await db.badges.bulkAdd(toAdd.map((badgeId) => ({ challengeId, badgeId, unlockedAt }) as Badge))
      return toAdd
    })
  },
}

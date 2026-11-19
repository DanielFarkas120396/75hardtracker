import { allRows } from '../table'
import { getDb, transaction } from '../open'
import type { Badge } from '../types'

/** The badges. Same calls and behaviour as the web app's badgeRepo (src/db/repositories/badgeRepo.ts). */
export const badgeRepo = {
  async getForChallenge(challengeId: number): Promise<Badge[]> {
    return allRows(getDb(), 'badges', 'WHERE challengeId = ?', [challengeId])
  },

  /**
   * Unlocks each of `badgeIds` for the challenge unless it is already unlocked, in one transaction. Returns only the
   * ids actually added, so two evaluations at once never unlock (or toast) a badge twice.
   */
  async unlockMissing(challengeId: number, badgeIds: string[]): Promise<string[]> {
    if (badgeIds.length === 0) return []
    return transaction(async (db) => {
      const unlockedAt = new Date().toISOString()
      const added: string[] = []
      for (const badgeId of new Set(badgeIds)) {
        const { changes } = await db.runAsync('INSERT OR IGNORE INTO badges (challengeId, badgeId, unlockedAt) VALUES (?, ?, ?)', [challengeId, badgeId, unlockedAt])
        if (changes > 0) added.push(badgeId)
      }
      return added
    })
  },
}

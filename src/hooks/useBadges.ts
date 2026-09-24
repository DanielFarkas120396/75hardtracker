import { useLiveQuery } from 'dexie-react-hooks'
import { badgeRepo } from '../db/repositories/badgeRepo'
import type { Badge } from '../db/types'

/** Badges unlocked so far in the given challenge, live-updating from Dexie. */
export function useBadges(challengeId: number | undefined): Badge[] {
  return (
    useLiveQuery(async () => {
      if (challengeId === undefined) return []
      return badgeRepo.getForChallenge(challengeId)
    }, [challengeId]) ?? []
  )
}

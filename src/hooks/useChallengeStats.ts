import { useLiveQuery } from 'dexie-react-hooks'
import { loadChallengeDays } from '../db/challengeDays'
import { calculateChallengeStats, EMPTY_CHALLENGE_STATS, type ChallengeStats } from '../logic/stats'

/** XP and running totals for one attempt, from one batched live query. All zeros while loading. */
export function useChallengeStats(challengeId: number | undefined): ChallengeStats {
  return (
    useLiveQuery(async () => {
      if (challengeId === undefined) return EMPTY_CHALLENGE_STATS
      return calculateChallengeStats(await loadChallengeDays(challengeId))
    }, [challengeId]) ?? EMPTY_CHALLENGE_STATS
  )
}

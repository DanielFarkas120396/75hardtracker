import { useLiveQuery } from 'dexie-react-hooks'
import { dayEntryRepo } from '../db/repositories/dayEntryRepo'
import { calculateStreak } from '../logic/streak'

/** Current streak (consecutive completed days) for the given challenge. */
export function useStreak(challengeId: number | undefined) {
  return (
    useLiveQuery(async () => {
      if (challengeId === undefined) return 0
      const entries = await dayEntryRepo.getAllForChallenge(challengeId)
      return calculateStreak(entries.map((e) => ({ dayNumber: e.dayNumber, completed: e.completed })))
    }, [challengeId]) ?? 0
  )
}

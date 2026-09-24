import { useLiveQuery } from 'dexie-react-hooks'
import { groupWorkoutsByEntry, toDayTaskData } from '../db/mappers'
import { dayEntryRepo } from '../db/repositories/dayEntryRepo'
import { workoutRepo } from '../db/repositories/workoutRepo'
import { calculateDayXp } from '../logic/xp'

/** Total XP earned so far in the given challenge, recomputed from its day entries. */
export function useXpTotal(challengeId: number | undefined) {
  return (
    useLiveQuery(async () => {
      if (challengeId === undefined) return 0

      const entries = await dayEntryRepo.getAllForChallenge(challengeId)
      const workoutsByEntry = groupWorkoutsByEntry(await workoutRepo.getForDayEntries(entries.map((e) => e.id)))

      let total = 0
      let runningStreak = 0
      for (const entry of entries) {
        runningStreak = entry.completed ? runningStreak + 1 : 0
        total += calculateDayXp(toDayTaskData(entry, workoutsByEntry.get(entry.id) ?? []), runningStreak).total
      }

      return total
    }, [challengeId]) ?? 0
  )
}

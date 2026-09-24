import { useLiveQuery } from 'dexie-react-hooks'
import { dayEntryRepo } from '../db/repositories/dayEntryRepo'
import { workoutRepo } from '../db/repositories/workoutRepo'
import { calculateDayXp } from '../logic/xp'
import type { DayTaskData } from '../logic/types'

/** Total XP earned so far in the given challenge, recomputed from its day entries. */
export function useXpTotal(challengeId: number | undefined) {
  return (
    useLiveQuery(async () => {
      if (challengeId === undefined) return 0

      const entries = (await dayEntryRepo.getAllForChallenge(challengeId)).sort((a, b) => a.dayNumber - b.dayNumber)

      let total = 0
      let runningStreak = 0

      for (const entry of entries) {
        const workouts = await workoutRepo.getForDayEntry(entry.id)
        const data: DayTaskData = {
          water_ml: entry.water_ml,
          pages_read: entry.pages_read,
          dietFollowed: entry.dietFollowed,
          noAlcohol: entry.noAlcohol,
          hasPhoto: entry.photoId != null,
          workouts: workouts.map((w) => ({ durationMin: w.durationMin, isOutdoor: w.isOutdoor })),
        }
        runningStreak = entry.completed ? runningStreak + 1 : 0
        total += calculateDayXp(data, runningStreak).total
      }

      return total
    }, [challengeId]) ?? 0
  )
}

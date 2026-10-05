import { useLiveQuery } from 'dexie-react-hooks'
import { dayEntryRepo } from '../db/repositories/dayEntryRepo'
import { workoutRepo } from '../db/repositories/workoutRepo'
import { workoutHistory, type WorkoutHistory, type WorkoutSession } from '../logic/workoutHistory'

/** An attempt's workouts grouped by activity, live from Dexie. `undefined` while loading. */
export function useWorkoutHistory(challengeId: number): WorkoutHistory | undefined {
  return useLiveQuery(async () => {
    const entries = await dayEntryRepo.getAllForChallenge(challengeId)
    const workouts = await workoutRepo.getForDayEntries(entries.map((e) => e.id))
    const entryById = new Map(entries.map((e) => [e.id, e]))
    const sessions = workouts.flatMap((w): WorkoutSession[] => {
      const entry = entryById.get(w.dayEntryId)
      return entry ? [{ ...w, dayNumber: entry.dayNumber, date: entry.date }] : []
    })
    return workoutHistory(sessions)
  }, [challengeId])
}

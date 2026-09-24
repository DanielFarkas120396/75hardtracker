import { useLiveQuery } from 'dexie-react-hooks'
import { workoutRepo } from '../db/repositories/workoutRepo'
import type { Workout } from '../db/types'

/**
 * Workouts logged against a given DayEntry, live-updating from Dexie.
 * Returns `undefined` while loading (or with no entry yet) — callers should
 * treat that as "not ready" rather than "zero workouts", since a live
 * query's own loading state resolves independently of the DayEntry query.
 */
export function useWorkoutsForEntry(dayEntryId: number | undefined): Workout[] | undefined {
  return useLiveQuery(async () => {
    if (dayEntryId === undefined) return undefined
    return workoutRepo.getForDayEntry(dayEntryId)
  }, [dayEntryId])
}

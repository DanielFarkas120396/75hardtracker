import { useLiveQuery } from 'dexie-react-hooks'
import { workoutRepo } from '../db/repositories/workoutRepo'

/** Workouts logged against a given DayEntry, live-updating from Dexie. */
export function useWorkoutsForEntry(dayEntryId: number | undefined) {
  return (
    useLiveQuery(async () => {
      if (dayEntryId === undefined) return []
      return workoutRepo.getForDayEntry(dayEntryId)
    }, [dayEntryId]) ?? []
  )
}

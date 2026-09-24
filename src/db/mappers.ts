import type { DayTaskData } from '../logic/types'
import type { DayEntry, Workout } from './types'

/** Maps a DayEntry row and its Workout rows onto the plain data the logic module works with. */
export function toDayTaskData(entry: DayEntry, workouts: Workout[]): DayTaskData {
  return {
    water_ml: entry.water_ml,
    pages_read: entry.pages_read,
    dietFollowed: entry.dietFollowed,
    noAlcohol: entry.noAlcohol,
    hasPhoto: entry.photoId != null,
    workouts: workouts.map((w) => ({ durationMin: w.durationMin, isOutdoor: w.isOutdoor })),
  }
}

/** Groups workouts by the DayEntry they belong to. */
export function groupWorkoutsByEntry(workouts: Workout[]): Map<number, Workout[]> {
  const byEntry = new Map<number, Workout[]>()
  for (const workout of workouts) {
    const list = byEntry.get(workout.dayEntryId)
    if (list) list.push(workout)
    else byEntry.set(workout.dayEntryId, [workout])
  }
  return byEntry
}

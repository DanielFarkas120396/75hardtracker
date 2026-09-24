import { useMemo } from 'react'
import { isDayComplete, missingTasks, taskCompletionMap } from '../logic/dayCompletion'
import type { DayTaskData } from '../logic/types'
import type { DayEntry, Workout } from '../db/types'

/** Derives per-task and overall completion for a DayEntry + its Workouts. */
export function useDayCompletion(entry: DayEntry | undefined, workouts: Workout[] | undefined) {
  return useMemo(() => {
    if (!entry || !workouts) return undefined

    const data: DayTaskData = {
      water_ml: entry.water_ml,
      pages_read: entry.pages_read,
      dietFollowed: entry.dietFollowed,
      noAlcohol: entry.noAlcohol,
      hasPhoto: entry.photoId != null,
      workouts: workouts.map((w) => ({ durationMin: w.durationMin, isOutdoor: w.isOutdoor })),
    }

    return {
      data,
      completion: taskCompletionMap(data),
      missing: missingTasks(data),
      isComplete: isDayComplete(data),
    }
  }, [entry, workouts])
}

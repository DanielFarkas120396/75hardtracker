import { useMemo } from 'react'
import { toDayTaskData } from '../db/mappers'
import type { DayEntry, Workout } from '../db/types'
import { isDayComplete, missingTasks, taskCompletionMap } from '../logic/dayCompletion'
import { RULESETS } from '../logic/rulesets'

/** Derives per-task and overall completion for a DayEntry + its Workouts. */
export function useDayCompletion(entry: DayEntry | undefined, workouts: Workout[] | undefined) {
  return useMemo(() => {
    if (!entry || !workouts) return undefined

    const data = toDayTaskData(entry, workouts)
    return {
      data,
      completion: taskCompletionMap(data, RULESETS.hard),
      missing: missingTasks(data, RULESETS.hard),
      isComplete: isDayComplete(data, RULESETS.hard),
    }
  }, [entry, workouts])
}

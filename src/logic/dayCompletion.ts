import type { Ruleset } from './rulesets'
import type { DayTaskData, TaskId, WorkoutTaskData } from './types'

/** The five daily tasks, in display order. */
export const TASK_IDS: readonly TaskId[] = ['workouts', 'diet', 'water', 'reading', 'photo']

/** Whether a single workout lasts long enough to count toward the day's workouts. */
export function isQualifyingWorkout(workout: WorkoutTaskData, rules: Ruleset): boolean {
  return workout.durationMin >= rules.minWorkoutMin
}

export function isWorkoutsTaskComplete(data: DayTaskData, rules: Ruleset): boolean {
  const qualifying = data.workouts.filter((workout) => isQualifyingWorkout(workout, rules))
  return qualifying.length >= rules.requiredWorkouts && (!rules.requireOutdoor || qualifying.some((w) => w.isOutdoor))
}

export function isDietTaskComplete(data: DayTaskData): boolean {
  return data.dietFollowed && data.noAlcohol
}

export function isWaterTaskComplete(data: DayTaskData, rules: Ruleset): boolean {
  return data.water_ml >= rules.waterTargetMl
}

export function isReadingTaskComplete(data: DayTaskData, rules: Ruleset): boolean {
  return data.pages_read >= rules.pagesTarget
}

export function isPhotoTaskComplete(data: DayTaskData): boolean {
  return data.hasPhoto
}

/** Per-task completion state, keyed by task id. */
export function taskCompletionMap(data: DayTaskData, rules: Ruleset): Record<TaskId, boolean> {
  return {
    workouts: isWorkoutsTaskComplete(data, rules),
    diet: isDietTaskComplete(data),
    water: isWaterTaskComplete(data, rules),
    reading: isReadingTaskComplete(data, rules),
    photo: isPhotoTaskComplete(data),
  }
}

/** A day is complete only if every one of the five tasks is complete. */
export function isDayComplete(data: DayTaskData, rules: Ruleset): boolean {
  return Object.values(taskCompletionMap(data, rules)).every(Boolean)
}

/** Task ids that are not yet complete, in the fixed display order. */
export function missingTasks(data: DayTaskData, rules: Ruleset): TaskId[] {
  const map = taskCompletionMap(data, rules)
  return TASK_IDS.filter((task) => !map[task])
}

/** Whether anything at all has been logged for the day (even if no task is complete yet). */
export function hasAnyProgress(data: DayTaskData): boolean {
  return (
    data.water_ml > 0 ||
    data.pages_read > 0 ||
    data.dietFollowed ||
    data.noAlcohol ||
    data.hasPhoto ||
    data.workouts.length > 0
  )
}

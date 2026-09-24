import { MIN_WORKOUT_MIN, PAGES_TARGET, REQUIRED_QUALIFYING_WORKOUTS, WATER_TARGET_ML } from './constants'
import type { DayTaskData, TaskId, WorkoutTaskData } from './types'

/** The five daily tasks, in display order. */
export const TASK_IDS: readonly TaskId[] = ['workouts', 'diet', 'water', 'reading', 'photo']

/** Whether a single workout counts toward the "two workouts" requirement (>= MIN_WORKOUT_MIN minutes). */
export function isQualifyingWorkout(workout: WorkoutTaskData): boolean {
  return workout.durationMin >= MIN_WORKOUT_MIN
}

export function isWorkoutsTaskComplete(data: DayTaskData): boolean {
  const qualifying = data.workouts.filter(isQualifyingWorkout)
  return qualifying.length >= REQUIRED_QUALIFYING_WORKOUTS && qualifying.some((w) => w.isOutdoor)
}

export function isDietTaskComplete(data: DayTaskData): boolean {
  return data.dietFollowed && data.noAlcohol
}

export function isWaterTaskComplete(data: DayTaskData): boolean {
  return data.water_ml >= WATER_TARGET_ML
}

export function isReadingTaskComplete(data: DayTaskData): boolean {
  return data.pages_read >= PAGES_TARGET
}

export function isPhotoTaskComplete(data: DayTaskData): boolean {
  return data.hasPhoto
}

/** Per-task completion state, keyed by task id. */
export function taskCompletionMap(data: DayTaskData): Record<TaskId, boolean> {
  return {
    workouts: isWorkoutsTaskComplete(data),
    diet: isDietTaskComplete(data),
    water: isWaterTaskComplete(data),
    reading: isReadingTaskComplete(data),
    photo: isPhotoTaskComplete(data),
  }
}

/** A day is complete only if every one of the five tasks is complete. */
export function isDayComplete(data: DayTaskData): boolean {
  const map = taskCompletionMap(data)
  return Object.values(map).every(Boolean)
}

/** Task ids that are not yet complete, in the fixed display order. */
export function missingTasks(data: DayTaskData): TaskId[] {
  const map = taskCompletionMap(data)
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

import { PAGES_TARGET, WATER_TARGET_ML } from '../logic/constants'
import { TASK_IDS } from '../logic/dayCompletion'
import type { TaskId } from '../logic/types'

/** Short task names for lists, e.g. "missed Water, Photo". */
export const TASK_NAMES: Record<TaskId, string> = {
  workouts: 'Workouts',
  diet: 'Diet',
  water: 'Water',
  reading: 'Reading',
  photo: 'Photo',
}

/**
 * Cheers flashed on a task card the moment it's completed. Each task has a
 * few, rotated by day number so the same line doesn't show up every day.
 * Keep them short: they sit in a one-line pill on the card's top edge.
 */
const TASK_CHEERS: Record<TaskId, readonly string[]> = {
  workouts: ['Both workouts done! 💪', 'Two sessions in the bank', 'Sweat logged. Beast mode.'],
  diet: ['Clean eating, locked in 🥗', 'Diet on point today', 'No cheats, no drinks. Solid.'],
  water: ['Fully hydrated! 💧', `All ${WATER_TARGET_ML / 1000} L down`, 'Water goal crushed'],
  reading: [`${PAGES_TARGET} pages smarter 📖`, 'Brain fed for today', 'Reading done. Nice.'],
  photo: ['Progress captured! 📸', 'Future you will love this', 'Snap! Day documented.'],
}

/** The cheer for a task on a given challenge day (1–75). */
export function taskCheer(task: TaskId, dayNumber: number): string {
  const cheers = TASK_CHEERS[task]
  return cheers[(dayNumber - 1) % cheers.length]
}

/** What the mascot says when only this task is left. */
const LAST_TASK_LINES: Record<TaskId, string> = {
  workouts: 'Just the workouts left — finish strong!',
  diet: 'Just tick off your diet — almost there!',
  water: 'Just the water left — bottoms up!',
  reading: 'Just your pages left — finish strong!',
  photo: 'Just the progress photo left — say cheese!',
}

/** The mascot's speech bubble in the Today header, given the tasks still missing today. */
export function mascotLine(missing: readonly TaskId[]): string {
  const done = TASK_IDS.length - missing.length
  if (missing.length === 0) return 'Perfect day! See you tomorrow 🎉'
  if (missing.length === 1) return LAST_TASK_LINES[missing[0]]
  if (done === 0) return "New day, clean slate. Let's go!"
  return `${done} down, ${missing.length} to go!`
}

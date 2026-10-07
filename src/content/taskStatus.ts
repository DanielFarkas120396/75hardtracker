import { isQualifyingWorkout, TASK_IDS } from '../logic/dayCompletion'
import type { Ruleset } from '../logic/rulesets'
import type { DayTaskData, TaskId } from '../logic/types'
import { MOODS, type Mood } from './moods'
import { formatLiters } from './variants'

/** The six tiles of the Today board: the five tasks, then mood and notes. */
export type BoardTask = TaskId | 'notes'

export const BOARD_TASKS: readonly BoardTask[] = [...TASK_IDS, 'notes']

export const TASK_TITLES: Record<BoardTask, string> = {
  workouts: 'Workouts',
  diet: 'Diet',
  water: 'Water',
  reading: 'Reading',
  photo: 'Photo',
  notes: 'Mood & notes',
}

function plural(count: number, word: string): string {
  return `${count} ${count === 1 ? word : `${word}s`}`
}

/** Workouts that count toward the day; a recovery day counts as all of them. */
function workoutsDone(data: DayTaskData, rules: Ruleset): number {
  if (rules.restDaysPerWeek > 0 && data.restDay === true) return rules.requiredWorkouts
  return data.workouts.filter((w) => isQualifyingWorkout(w, rules)).length
}

/** A tile's one-line status: what's left while the task is open, what was done once it's complete. */
export function taskStatusLine(task: TaskId, data: DayTaskData, rules: Ruleset, complete: boolean, bookTitle?: string): string {
  switch (task) {
    case 'workouts': {
      if (complete) {
        if (rules.restDaysPerWeek > 0 && data.restDay === true) return 'Recovery day'
        const minutes = data.workouts.reduce((sum, w) => sum + w.durationMin, 0)
        return `${plural(data.workouts.length, 'workout')} · ${minutes} min`
      }
      const done = workoutsDone(data, rules)
      if (done === 0) return `0 of ${rules.requiredWorkouts} · ${rules.minWorkoutMin} min${rules.requiredWorkouts === 1 ? '' : ' each'}`
      return `${done} of ${rules.requiredWorkouts} logged`
    }
    case 'diet': {
      const social = rules.socialDaysPerWeek > 0 && data.socialDay === true
      // Short: the tile shows its switches beside this line.
      if (complete) return 'Followed'
      const toTick = social ? 1 : 2
      const ticked = (data.dietFollowed ? 1 : 0) + (!social && data.noAlcohol ? 1 : 0)
      return ticked === 0 ? `${toTick} to tick` : `${ticked} of ${toTick}`
    }
    case 'water':
      return complete
        ? `${formatLiters(data.water_ml)} L`
        : `${formatLiters(data.water_ml)} / ${formatLiters(rules.waterTargetMl)} L`
    case 'reading':
      return complete
        ? `${data.pages_read} pages${bookTitle ? ` · ${bookTitle}` : ''}`
        : `${data.pages_read} of ${rules.pagesTarget} pages`
    case 'photo':
      return complete ? 'Taken' : 'No photo yet'
  }
}

/** The mood tile's status: the mood picked, else whether notes were written. */
export function notesStatusLine(entry: { mood?: Mood; notes?: string }): string {
  const mood = MOODS.find((m) => m.value === entry.mood)
  if (mood) return `${mood.emoji} ${mood.label}`
  return entry.notes ? 'Notes saved' : 'How was today?'
}

/** How far a measurable task is, 0–1; null for the tick-box tasks (diet, photo). */
export function taskProgress(task: TaskId, data: DayTaskData, rules: Ruleset): number | null {
  switch (task) {
    case 'workouts':
      return Math.min(1, workoutsDone(data, rules) / rules.requiredWorkouts)
    case 'water':
      return Math.min(1, data.water_ml / rules.waterTargetMl)
    case 'reading':
      return Math.min(1, data.pages_read / rules.pagesTarget)
    case 'diet':
    case 'photo':
      return null
  }
}

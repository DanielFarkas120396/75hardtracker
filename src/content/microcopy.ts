import { formatLiters } from './variants'
import { TASK_IDS } from '../logic/dayCompletion'
import { formatHHmm, type Menace } from '../logic/menace'
import type { Ruleset } from '../logic/rulesets'
import type { TaskId } from '../logic/types'

/** Short task names for lists, e.g. "missed Water, Photo". */
export const TASK_NAMES: Record<TaskId, string> = {
  workouts: 'Workouts',
  diet: 'Diet',
  water: 'Water',
  reading: 'Reading',
  photo: 'Photo',
}

/** Each task's rule in a few words, e.g. for listing what a failed day missed. */
export function taskRule(task: TaskId, rules: Ruleset): string {
  switch (task) {
    case 'workouts': {
      const base = rules.requiredWorkouts === 1
        ? `1 workout of ${rules.minWorkoutMin}+ min`
        : `${rules.requiredWorkouts} workouts of ${rules.minWorkoutMin}+ min`
      return `${base}${rules.requireOutdoor ? ', one outdoors' : ''}${rules.restDaysPerWeek > 0 ? ' (or a recovery day)' : ''}`
    }
    case 'diet':
      return rules.dietKind === 'healthy'
        ? 'Ate healthy, no alcohol unless declared'
        : rules.socialDaysPerWeek > 0 ? 'Diet followed, no alcohol unless declared' : 'Diet followed, no alcohol'
    case 'water':
      return `${formatLiters(rules.waterTargetMl)} L of water`
    case 'reading':
      return `${rules.pagesTarget} pages read`
    case 'photo':
      return 'Progress photo'
  }
}

/**
 * Cheers flashed on a task card the moment it's completed. Each task has a
 * few, rotated by day number so the same line doesn't show up every day.
 * Keep them short: they sit in a one-line pill on the card's top edge.
 */
function taskCheers(task: TaskId, rules: Ruleset): readonly string[] {
  switch (task) {
    case 'workouts':
      return rules.requiredWorkouts === 2
        ? ['Both workouts done! 💪', 'Two sessions in the bank', 'Sweat logged. Beast mode.']
        : ['Workout done! 💪', 'Session in the bank', 'Sweat logged. Beast mode.']
    case 'diet':
      return rules.dietKind === 'strict'
        ? ['Clean eating, locked in 🥗', 'Diet on point today', 'No cheats, no drinks. Solid.']
        : ['Clean eating, locked in 🥗', 'Diet on point today', 'Ate well. Solid.']
    case 'water':
      return ['Fully hydrated! 💧', `All ${formatLiters(rules.waterTargetMl)} L down`, 'Water goal crushed']
    case 'reading':
      return [`${rules.pagesTarget} pages smarter 📖`, 'Brain fed for today', 'Reading done. Nice.']
    case 'photo':
      return ['Progress captured! 📸', 'Future you will love this', 'Snap! Day documented.']
  }
}

/** The cheer for a task on a given challenge day (1–75), worded for the attempt's rules. */
export function taskCheer(task: TaskId, dayNumber: number, rules: Ruleset): string {
  const cheers = taskCheers(task, rules)
  return cheers[(dayNumber - 1) % cheers.length]
}

/** The duck's lines once every task is done, rotated by day number. */
const CONTENT_LINES = ['Perfect day. The knife rests.', 'All five. You may live.', 'Acceptable. Same time tomorrow.'] as const

/** What the duck says when only this task is left, and there's still time. */
const ONE_LEFT_LINES: Record<TaskId, string> = {
  workouts: 'Just the workouts left. Go.',
  diet: "Tick off your diet. I'll wait.",
  water: 'Just the water left. Drink.',
  reading: 'Just your pages left. Read.',
  photo: 'Just the photo left. Smile. Or else.',
}

export const POKE_LINES = [
  'Hands off. Hands on your water bottle.',
  'Poke me again. I dare you.',
  'That tickles. The knife does not.',
] as const
export const LUNGE_LINE = "That's it."
export const GLARE_LINE = 'I saw that.'

/** The poke line for the `count`th poke (0-based), cycling. */
export function pokeLine(count: number): string {
  return POKE_LINES[count % POKE_LINES.length]
}

/** The duck's answer once a plan is saved, quoting its earliest time. */
export function planSavedLine(at: number): string {
  return `${formatHHmm(at)}. Not a minute later.`
}

function watchingLine(missing: readonly TaskId[]): string {
  const done = TASK_IDS.length - missing.length
  if (missing.length === 1) return ONE_LEFT_LINES[missing[0]]
  if (done === 0) return "New day. I'm watching."
  return `${done} down, ${missing.length} to go. I'm watching.`
}

/** The duck's speech bubble on Today, from his menace and the tasks still missing. */
export function duckLine({ menace, missing, dayNumber }: { menace: Menace; missing: readonly TaskId[]; dayNumber: number }): string {
  switch (menace.reason) {
    case 'done':
      return CONTENT_LINES[(dayNumber - 1) % CONTENT_LINES.length]
    case 'plenty':
      return watchingLine(missing)
    case 'plan-pending':
      return menace.next
        ? `${TASK_NAMES[menace.next.task]} at ${formatHHmm(menace.next.at)}. I'll be there.`
        : watchingLine(missing)
    case 'plan-due':
      return menace.next
        ? `It's ${formatHHmm(menace.next.at)}. ${TASK_NAMES[menace.next.task]}. I'm watching.`
        : watchingLine(missing)
    case 'close':
      return "Tick. Tock. You're cutting it close."
    case 'plan-broken':
      return menace.broken ? `You said ${formatHHmm(menace.broken.at)}.` : "Tick. Tock. You're cutting it close."
    case 'wont-fit':
      return "Midnight's coming. So am I."
    case 'past-bedtime':
      return 'Past your bedtime. Not mine.'
  }
}

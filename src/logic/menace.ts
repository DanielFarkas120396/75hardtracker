import { MIN_WORKOUT_MIN, PAGES_TARGET, REQUIRED_QUALIFYING_WORKOUTS, WATER_TARGET_ML } from './constants'
import { isQualifyingWorkout, missingTasks } from './dayCompletion'
import type { DayTaskData, TaskId } from './types'

/** How menacing the duck is on the Today screen, calmest first. */
export type MenaceLevel = 'content' | 'watching' | 'tapping' | 'hunting'

/** Why the duck is at his level; it picks his line. */
export type MenaceReason =
  | 'done'
  | 'plenty'
  | 'plan-pending'
  | 'plan-due'
  | 'close'
  | 'plan-broken'
  | 'wont-fit'
  | 'past-bedtime'

export interface PlannedTask {
  task: TaskId
  /** Minutes since local midnight. */
  at: number
}

export interface Menace {
  level: MenaceLevel
  reason: MenaceReason
  /** The earliest plan still covering a missing task. */
  next?: PlannedTask
  /** The earliest plan whose window passed with its task still missing. */
  broken?: PlannedTask
}

export interface MenaceInput {
  data: DayTaskData
  /** Minutes since local midnight (0–1439). */
  nowMin: number
  /** Bedtime, in minutes since local midnight. */
  bedtimeMin: number
  /** Planned times (minutes since midnight) for some of today's tasks. */
  plans: Partial<Record<TaskId, number>>
  /** Each plan's estimate (minutes) frozen when it was saved; falls back to the live `minutesToFinish` when absent. */
  estimates?: Partial<Record<TaskId, number>>
}

export type PlanError = 'past' | 'past-midnight'

export const DEFAULT_BEDTIME = '23:00'
export const EARLIEST_BEDTIME = '18:00'
export const LATEST_BEDTIME = '23:59'

/** A plan's grace after the task's expected end, before it counts as broken. */
export const PLAN_GRACE_MIN = 15
/** Long tasks make the duck tap once the slack before bedtime is this small. */
const TAPPING_SLACK_MIN = 60
/** Short tasks only count this close to bedtime. */
const SHORT_TASK_WINDOW_MIN = 30
const WATER_MIN_PER_LITRE = 60
const READING_MIN_PER_PAGE = 2
const QUICK_TASK_MIN = 2
const MINUTES_PER_DAY = 24 * 60

/** Tasks that take real time; the others fit in a few minutes. */
const LONG_TASKS: readonly TaskId[] = ['workouts', 'water']

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)

/** "HH:mm" (24-hour) → minutes since midnight, or null when it isn't a valid time. */
export function parseHHmm(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value)
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

/** Minutes since midnight → "HH:mm". */
export function formatHHmm(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

/** Whether "HH:mm" is an allowed bedtime: 18:00–23:59. */
export function isValidBedtime(value: string): boolean {
  const minutes = parseHHmm(value)
  return minutes !== null && minutes >= parseHHmm(EARLIEST_BEDTIME)! && minutes <= parseHHmm(LATEST_BEDTIME)!
}

/** A stored bedtime as minutes; anything missing or invalid falls back to 23:00. */
export function bedtimeMinutes(value: unknown): number {
  return typeof value === 'string' && isValidBedtime(value) ? parseHHmm(value)! : parseHHmm(DEFAULT_BEDTIME)!
}

/** A day's saved plan ("HH:mm" values) as minutes, skipping anything malformed. */
export function plansToMinutes(plans: Partial<Record<TaskId, string>> | undefined): Partial<Record<TaskId, number>> {
  const result: Partial<Record<TaskId, number>> = {}
  for (const [task, time] of Object.entries(plans ?? {}) as [TaskId, string | undefined][]) {
    const minutes = time === undefined ? null : parseHHmm(time)
    if (minutes !== null) result[task] = minutes
  }
  return result
}

/** Qualifying workouts still to do, or one more if two qualify but neither is outdoors. */
function workoutsStillNeeded(data: DayTaskData): number {
  const qualifying = data.workouts.filter(isQualifyingWorkout)
  const missing = Math.max(0, REQUIRED_QUALIFYING_WORKOUTS - qualifying.length)
  if (missing > 0) return missing
  return qualifying.some((workout) => workout.isOutdoor) ? 0 : 1
}

/** Estimated minutes to finish a task from where the day stands. */
export function minutesToFinish(task: TaskId, data: DayTaskData): number {
  switch (task) {
    case 'workouts':
      return workoutsStillNeeded(data) * MIN_WORKOUT_MIN
    case 'water':
      // Integer maths first: 1700 ml → 102 min exactly, never 103.
      return Math.ceil((Math.max(0, WATER_TARGET_ML - data.water_ml) * WATER_MIN_PER_LITRE) / 1000)
    case 'reading':
      return Math.max(0, PAGES_TARGET - data.pages_read) * READING_MIN_PER_PAGE
    case 'diet':
    case 'photo':
      return QUICK_TASK_MIN
  }
}

/** Why a planned time can't work, or null when it can. A blank or malformed time means "no plan", not an error. */
export function planError(task: TaskId, time: string, data: DayTaskData, nowMin: number): PlanError | null {
  const at = parseHHmm(time)
  if (at === null) return null
  if (at < nowMin) return 'past'
  if (at + minutesToFinish(task, data) > MINUTES_PER_DAY) return 'past-midnight'
  return null
}

const earlier = (current: PlannedTask | undefined, candidate: PlannedTask): PlannedTask =>
  !current || candidate.at < current.at ? candidate : current

/**
 * How menacing the duck should be right now. He only threatens when the
 * remaining tasks no longer fit before bedtime, or when a plan was broken.
 * The full rule, with reference cases, is in section 2 of
 * docs/superpowers/specs/2026-09-25-knife-duck-companion-design.md.
 */
export function menace({ data, nowMin, bedtimeMin, plans, estimates }: MenaceInput): Menace {
  const missing = missingTasks(data)
  if (missing.length === 0) return { level: 'content', reason: 'done' }

  const uncovered: TaskId[] = []
  let next: PlannedTask | undefined
  let broken: PlannedTask | undefined
  let planDue = false
  for (const task of missing) {
    const at = plans[task]
    if (at === undefined) {
      uncovered.push(task)
      continue
    }
    const windowEnd = at + (estimates?.[task] ?? minutesToFinish(task, data)) + PLAN_GRACE_MIN
    if (nowMin >= windowEnd) {
      uncovered.push(task)
      broken = earlier(broken, { task, at })
      continue
    }
    if (nowMin >= at) planDue = true
    next = earlier(next, { task, at })
  }

  if (uncovered.length === 0) return { level: 'watching', reason: planDue ? 'plan-due' : 'plan-pending', next }

  const timeLeft = bedtimeMin - nowMin
  const long = uncovered.filter((task) => LONG_TASKS.includes(task))
  const short = uncovered.filter((task) => !LONG_TASKS.includes(task))
  const needed = sum(uncovered.map((task) => minutesToFinish(task, data)))
  const neededShort = sum(short.map((task) => minutesToFinish(task, data)))

  let wontFit = false
  let close = false
  if (long.length > 0) {
    const slack = timeLeft - needed
    if (slack <= 0) wontFit = true
    else if (slack <= TAPPING_SLACK_MIN) close = true
  }
  if (short.length > 0) {
    if (timeLeft - neededShort <= 0) wontFit = true
    else if (timeLeft <= SHORT_TASK_WINDOW_MIN) close = true
  }

  if (wontFit) return { level: 'hunting', reason: timeLeft <= 0 ? 'past-bedtime' : 'wont-fit', next, broken }
  if (broken) return { level: 'tapping', reason: 'plan-broken', next, broken }
  if (close) return { level: 'tapping', reason: 'close', next, broken }
  return { level: 'watching', reason: 'plenty', next, broken }
}

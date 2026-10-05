import { dateForDayNumber, dayNumberForDate } from '../lib/dates'
import { CHALLENGE_LENGTH } from './constants'
import { isDayComplete, missingTasks, TASK_IDS } from './dayCompletion'
import { isChallengeDay } from './days'
import { missedDayNumbers } from './restart'
import type { Ruleset } from './rulesets'
import type { ChallengeDayData, ChallengeStatus, DayCompletionSummary, TaskId } from './types'

export interface AttemptSummary {
  /**
   * How far the attempt got: the day it failed on, 75 once completed, the
   * day it was given up on, or today's day while it's running (0 before Day 1).
   */
  reachedDay: number
  completedDays: number
  startDate: string
  /** The date of the last day reached; unset while the attempt is still running. */
  endDate?: string
}

/** Sums up one attempt from its challenge fields and logged days. */
export function summarizeAttempt(params: {
  startDate: string
  status: ChallengeStatus
  /** When a given-up attempt ended (Challenge.abandonedOn). */
  abandonedOn?: string
  days: readonly ChallengeDayData[]
  todayDayNumber: number
  rules: Ruleset
}): AttemptSummary {
  const { startDate, status, abandonedOn, days, todayDayNumber, rules } = params
  const summaries = days.map((d) => ({ dayNumber: d.dayNumber, completed: isDayComplete(d.data, rules) }))
  const reachedDay = reachedDayOf(status, summaries, todayDayNumber, rules.jokers, givenUpDay(startDate, abandonedOn))

  return {
    reachedDay,
    completedDays: summaries.filter((s) => s.completed).length,
    startDate,
    endDate: status !== 'active' && reachedDay >= 1 ? dateForDayNumber(startDate, reachedDay) : undefined,
  }
}

function reachedDayOf(
  status: ChallengeStatus,
  summaries: DayCompletionSummary[],
  todayDayNumber: number,
  jokers: number,
  givenUp: number | undefined,
): number {
  if (status === 'completed') return CHALLENGE_LENGTH
  if (status === 'active') {
    return Number.isFinite(todayDayNumber) ? Math.min(Math.max(todayDayNumber, 0), CHALLENGE_LENGTH) : 0
  }
  // Given up: that day, or the last logged challenge day when its date is missing (a hand-edited backup).
  if (status === 'abandoned') {
    return givenUp ?? summaries.reduce((last, s) => (isChallengeDay(s.dayNumber) ? Math.max(last, s.dayNumber) : last), 0)
  }
  // Failed: the miss that used up the jokers, the first miss if there weren't that many, or Day 75 if none at all.
  const missed = missedDayNumbers(summaries, CHALLENGE_LENGTH + 1)
  return missed[jokers] ?? missed[0] ?? CHALLENGE_LENGTH
}

/**
 * The day an attempt was given up on: its `abandonedOn` date as a day
 * number, or undefined when that date is missing or isn't a challenge day.
 */
export function givenUpDay(startDate: string, abandonedOn: string | undefined): number | undefined {
  if (!abandonedOn) return undefined
  const day = dayNumberForDate(startDate, abandonedOn)
  return isChallengeDay(day) ? day : undefined
}

/** A stretch of consecutive complete days, or a single day with tasks missing. */
export type AttemptDayRow =
  | { kind: 'complete'; fromDay: number; toDay: number }
  | { kind: 'incomplete'; dayNumber: number; missing: TaskId[] }

/**
 * Days 1 to `reachedDay` as rows for the attempt detail: runs of complete
 * days are grouped, and every other day lists what was missed (all five
 * tasks when it has no entry).
 */
export function attemptDayRows(days: readonly ChallengeDayData[], reachedDay: number, rules: Ruleset): AttemptDayRow[] {
  const dataByDay = new Map(days.map((d) => [d.dayNumber, d.data]))
  const rows: AttemptDayRow[] = []

  for (let dayNumber = 1; dayNumber <= reachedDay; dayNumber++) {
    const data = dataByDay.get(dayNumber)
    const missing = data ? missingTasks(data, rules) : [...TASK_IDS]
    const last = rows.at(-1)

    if (missing.length > 0) rows.push({ kind: 'incomplete', dayNumber, missing })
    else if (last?.kind === 'complete') last.toDay = dayNumber
    else rows.push({ kind: 'complete', fromDay: dayNumber, toDay: dayNumber })
  }
  return rows
}

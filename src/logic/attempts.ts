import { dateForDayNumber } from '../lib/dates'
import { CHALLENGE_LENGTH } from './constants'
import { isDayComplete, missingTasks, TASK_IDS } from './dayCompletion'
import { findFirstIncompleteDayNumber } from './restart'
import type { ChallengeDayData, ChallengeStatus, DayCompletionSummary, TaskId } from './types'
import { calculateChallengeXp } from './xp'

export interface AttemptSummary {
  /**
   * How far the attempt got: the day it failed on, 75 once completed, or
   * today's day while it's running (0 before Day 1).
   */
  reachedDay: number
  completedDays: number
  startDate: string
  /** The date of the last day reached; unset while the attempt is still running. */
  endDate?: string
  xp: number
}

/** Sums up one attempt from its challenge fields and logged days. */
export function summarizeAttempt(params: {
  startDate: string
  status: ChallengeStatus
  days: readonly ChallengeDayData[]
  todayDayNumber: number
}): AttemptSummary {
  const { startDate, status, days, todayDayNumber } = params
  const summaries = days.map((d) => ({ dayNumber: d.dayNumber, completed: isDayComplete(d.data) }))
  const reachedDay = reachedDayOf(status, summaries, todayDayNumber)

  return {
    reachedDay,
    completedDays: summaries.filter((s) => s.completed).length,
    startDate,
    endDate: status !== 'active' && reachedDay >= 1 ? dateForDayNumber(startDate, reachedDay) : undefined,
    xp: calculateChallengeXp(days),
  }
}

function reachedDayOf(status: ChallengeStatus, summaries: DayCompletionSummary[], todayDayNumber: number): number {
  if (status === 'completed') return CHALLENGE_LENGTH
  if (status === 'active') {
    return Number.isFinite(todayDayNumber) ? Math.min(Math.max(todayDayNumber, 0), CHALLENGE_LENGTH) : 0
  }
  // Failed: the first day that wasn't completed, whether its entry is incomplete or missing.
  return findFirstIncompleteDayNumber(summaries, CHALLENGE_LENGTH + 1) ?? CHALLENGE_LENGTH
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
export function attemptDayRows(days: readonly ChallengeDayData[], reachedDay: number): AttemptDayRow[] {
  const dataByDay = new Map(days.map((d) => [d.dayNumber, d.data]))
  const rows: AttemptDayRow[] = []

  for (let dayNumber = 1; dayNumber <= reachedDay; dayNumber++) {
    const data = dataByDay.get(dayNumber)
    const missing = data ? missingTasks(data) : [...TASK_IDS]
    const last = rows.at(-1)

    if (missing.length > 0) rows.push({ kind: 'incomplete', dayNumber, missing })
    else if (last?.kind === 'complete') last.toDay = dayNumber
    else rows.push({ kind: 'complete', fromDay: dayNumber, toDay: dayNumber })
  }
  return rows
}

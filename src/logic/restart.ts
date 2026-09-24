import { CHALLENGE_LENGTH } from './constants'
import type { ChallengeStatus, DayCompletionSummary } from './types'

/**
 * The earliest day strictly before `todayDayNumber` that has no entry at
 * all, or an entry that isn't complete. `undefined` if every prior day is
 * complete.
 */
export function findFirstIncompleteDayNumber(
  dayEntries: DayCompletionSummary[],
  todayDayNumber: number,
): number | undefined {
  const entryByDayNumber = new Map(dayEntries.map((e) => [e.dayNumber, e]))

  for (let day = 1; day < todayDayNumber; day++) {
    const entry = entryByDayNumber.get(day)
    if (!entry || !entry.completed) {
      return day
    }
  }
  return undefined
}

/**
 * Determines whether an active challenge should transition to `failed` or
 * `completed`, based on every day strictly before `todayDayNumber`. A day
 * counts as missed if it has no entry at all, or an entry that isn't
 * complete — so gaps (the app wasn't opened that day) fail the challenge
 * just like an explicitly incomplete day.
 */
export function evaluateChallengeStatus(params: {
  currentStatus: ChallengeStatus
  dayEntries: DayCompletionSummary[]
  todayDayNumber: number
}): ChallengeStatus {
  if (params.currentStatus !== 'active') return params.currentStatus

  if (findFirstIncompleteDayNumber(params.dayEntries, params.todayDayNumber) !== undefined) {
    return 'failed'
  }

  const entryByDayNumber = new Map(params.dayEntries.map((e) => [e.dayNumber, e]))
  const finalDay = entryByDayNumber.get(CHALLENGE_LENGTH)
  if (finalDay?.completed && params.todayDayNumber >= CHALLENGE_LENGTH) {
    return 'completed'
  }

  return 'active'
}

export type GateKind = 'active' | 'needsRestart' | 'completed'

export interface GateResolution {
  kind: GateKind
  /** The first missed day, when `kind` is 'needsRestart'. */
  failedDayNumber?: number
}

/**
 * What the app should show for the current challenge: the normal screens
 * ('active', which includes the days before Day 1), the restart flow
 * ('needsRestart' — a day was missed or the attempt is already archived as
 * failed), or the victory screen ('completed').
 */
export function resolveChallengeGate(params: {
  currentStatus: ChallengeStatus
  dayEntries: DayCompletionSummary[]
  todayDayNumber: number
}): GateResolution {
  const status = evaluateChallengeStatus(params)
  if (status === 'completed') return { kind: 'completed' }
  if (status === 'active') return { kind: 'active' }

  const today = Number.isFinite(params.todayDayNumber) ? params.todayDayNumber : CHALLENGE_LENGTH + 1
  const failedDayNumber =
    findFirstIncompleteDayNumber(params.dayEntries, Math.min(today, CHALLENGE_LENGTH + 1)) ??
    Math.min(Math.max(today, 1), CHALLENGE_LENGTH)
  return { kind: 'needsRestart', failedDayNumber }
}

/** The attempt number for a new challenge: one more than the highest so far (1 for the first). */
export function nextAttemptNumber(existingAttemptNumbers: readonly number[]): number {
  return existingAttemptNumbers.reduce((max, n) => Math.max(max, n), 0) + 1
}

export interface NewChallenge {
  startDate: string
  attemptNumber: number
  status: 'active'
}

/** Builds the next Challenge to persist — after a failed attempt, a completed one, or on first launch. */
export function buildNextChallenge(existingAttemptNumbers: readonly number[], startDate: string): NewChallenge {
  return {
    startDate,
    attemptNumber: nextAttemptNumber(existingAttemptNumbers),
    status: 'active',
  }
}

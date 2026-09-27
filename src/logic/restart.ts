import { CHALLENGE_LENGTH } from './constants'
import type { ChallengeVariant } from './rulesets'
import type { ChallengeStatus, DayCompletionSummary } from './types'

/**
 * Days before today, never past Day 75, that have no entry at all or an
 * entry that isn't complete. Gaps (the app wasn't opened that day) count
 * just like an explicitly incomplete day.
 */
export function missedDayNumbers(dayEntries: DayCompletionSummary[], todayDayNumber: number): number[] {
  const completedDays = new Set(dayEntries.filter((e) => e.completed).map((e) => e.dayNumber))
  const lastDay = Math.min(todayDayNumber - 1, CHALLENGE_LENGTH)
  const missed: number[] = []
  for (let day = 1; day <= lastDay; day++) {
    if (!completedDays.has(day)) missed.push(day)
  }
  return missed
}

export interface ChallengeEvaluation {
  status: ChallengeStatus
  /** Every missed day so far (each one used a joker while the attempt is active). */
  missed: number[]
  /** The miss that failed the attempt, when `status` is 'failed' because of this evaluation. */
  failedDayNumber?: number
}

/**
 * Whether an active challenge should turn `failed` or `completed`. A miss
 * uses a joker; the first miss beyond them fails the attempt. It completes
 * once Day 75 is complete, or once Day 75 has passed with every miss
 * forgiven.
 */
export function evaluateChallenge(params: {
  currentStatus: ChallengeStatus
  dayEntries: DayCompletionSummary[]
  todayDayNumber: number
  jokers: number
}): ChallengeEvaluation {
  const missed = missedDayNumbers(params.dayEntries, params.todayDayNumber)
  if (params.currentStatus !== 'active') return { status: params.currentStatus, missed }
  if (missed.length > params.jokers) return { status: 'failed', missed, failedDayNumber: missed[params.jokers] }

  const finalDay = params.dayEntries.find((e) => e.dayNumber === CHALLENGE_LENGTH)
  const pastTheEnd = params.todayDayNumber > CHALLENGE_LENGTH
  const lastDayDone = params.todayDayNumber === CHALLENGE_LENGTH && finalDay?.completed === true
  if (pastTheEnd || lastDayDone) return { status: 'completed', missed }
  return { status: 'active', missed }
}

export type GateKind = 'active' | 'needsRestart' | 'completed' | 'abandoned'

export interface GateResolution {
  kind: GateKind
  /** The missed day that failed the attempt (the first miss beyond the jokers), when `kind` is 'needsRestart'. */
  failedDayNumber?: number
  /** Every missed day so far (each one used a joker while the attempt is active). */
  missed: number[]
}

/**
 * What the app should show for the current challenge: the normal screens
 * ('active', which includes the days before Day 1), the restart flow
 * ('needsRestart' — a day was missed beyond the ruleset's jokers, or the
 * attempt is already archived as failed), the victory screen
 * ('completed'), or the "You gave up" screen ('abandoned').
 */
export function resolveChallengeGate(params: {
  currentStatus: ChallengeStatus
  dayEntries: DayCompletionSummary[]
  todayDayNumber: number
  jokers: number
}): GateResolution {
  const evaluation = evaluateChallenge(params)
  if (evaluation.status === 'completed') return { kind: 'completed', missed: evaluation.missed }
  if (evaluation.status === 'active') return { kind: 'active', missed: evaluation.missed }
  if (evaluation.status === 'abandoned') return { kind: 'abandoned', missed: evaluation.missed }

  const today = Number.isFinite(params.todayDayNumber) ? params.todayDayNumber : CHALLENGE_LENGTH + 1
  const missed = missedDayNumbers(params.dayEntries, today)
  const failedDayNumber =
    evaluation.failedDayNumber ?? missed[params.jokers] ?? missed[0] ?? Math.min(Math.max(today, 1), CHALLENGE_LENGTH)
  return { kind: 'needsRestart', failedDayNumber, missed }
}

/** The attempt number for a new challenge: one more than the highest so far (1 for the first). */
export function nextAttemptNumber(existingAttemptNumbers: readonly number[]): number {
  return existingAttemptNumbers.reduce((max, n) => Math.max(max, n), 0) + 1
}

export interface NewChallenge {
  startDate: string
  attemptNumber: number
  status: 'active'
  variant: ChallengeVariant
}

/** Builds the next Challenge to persist — after a failed attempt, a completed one, or on first launch. */
export function buildNextChallenge(
  existingAttemptNumbers: readonly number[],
  startDate: string,
  variant: ChallengeVariant,
): NewChallenge {
  return {
    startDate,
    attemptNumber: nextAttemptNumber(existingAttemptNumbers),
    status: 'active',
    variant,
  }
}

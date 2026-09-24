import { CHALLENGE_LENGTH } from './constants'
import type { ChallengeStatus, DayCompletionSummary } from './types'

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

  const entryByDayNumber = new Map(params.dayEntries.map((e) => [e.dayNumber, e]))

  for (let day = 1; day < params.todayDayNumber; day++) {
    const entry = entryByDayNumber.get(day)
    if (!entry || !entry.completed) {
      return 'failed'
    }
  }

  const finalDay = entryByDayNumber.get(CHALLENGE_LENGTH)
  if (finalDay?.completed && params.todayDayNumber >= CHALLENGE_LENGTH) {
    return 'completed'
  }

  return 'active'
}

export interface RestartedChallenge {
  startDate: string
  attemptNumber: number
  status: 'active'
}

/** Builds the new Challenge to persist when the user confirms a restart. */
export function buildRestartedChallenge(previous: { attemptNumber: number }, startDate: string): RestartedChallenge {
  return {
    startDate,
    attemptNumber: previous.attemptNumber + 1,
    status: 'active',
  }
}

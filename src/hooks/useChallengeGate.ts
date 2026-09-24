import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { challengeRepo } from '../db/repositories/challengeRepo'
import { dayEntryRepo } from '../db/repositories/dayEntryRepo'
import type { Challenge, DayEntry } from '../db/types'
import { dayNumberForDate, todayISO } from '../lib/dates'
import { evaluateChallengeStatus } from '../logic/restart'

export interface ChallengeGate {
  challenge: Challenge
  dayEntries: DayEntry[]
  todayDayNumber: number
  /** True once a prior day was left incomplete and the challenge hasn't been restarted yet. */
  needsRestartConfirmation: boolean
}

/**
 * Evaluates whether the active challenge should be blocked behind the
 * restart-confirmation flow (a past day was missed) and auto-persists a
 * `completed` transition (no confirmation needed for finishing on time).
 * Returns `undefined` while loading.
 */
export function useChallengeGate(challenge: Challenge | undefined): ChallengeGate | undefined {
  const dayEntries = useLiveQuery(async () => {
    if (!challenge) return undefined
    return dayEntryRepo.getAllForChallenge(challenge.id)
  }, [challenge?.id])

  const todayDayNumber = challenge ? dayNumberForDate(challenge.startDate, todayISO()) : undefined

  const computedStatus =
    challenge && dayEntries && todayDayNumber !== undefined
      ? evaluateChallengeStatus({
          currentStatus: challenge.status,
          dayEntries: dayEntries.map((e) => ({ dayNumber: e.dayNumber, completed: e.completed })),
          todayDayNumber,
        })
      : undefined

  useEffect(() => {
    if (challenge && computedStatus === 'completed' && challenge.status !== 'completed') {
      void challengeRepo.updateStatus(challenge.id, 'completed')
    }
  }, [challenge, computedStatus])

  if (!challenge || !dayEntries || todayDayNumber === undefined) return undefined

  return {
    challenge,
    dayEntries,
    todayDayNumber,
    needsRestartConfirmation: computedStatus === 'failed' && challenge.status === 'active',
  }
}

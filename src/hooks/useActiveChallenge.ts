import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { challengeRepo } from '../db/repositories/challengeRepo'
import { todayISO } from '../lib/dates'

/**
 * The current active Challenge, live-updating from Dexie. Bootstraps
 * Challenge #1 / attempt 1 automatically the first time the app runs.
 * Returns `undefined` while loading.
 */
export function useActiveChallenge() {
  const challenge = useLiveQuery(async () => {
    const active = await challengeRepo.getActiveChallenge()
    return active ?? null
  }, [])

  useEffect(() => {
    if (challenge === null) {
      void challengeRepo.create({ startDate: todayISO(), attemptNumber: 1, status: 'active' })
    }
  }, [challenge])

  return challenge === null ? undefined : challenge
}

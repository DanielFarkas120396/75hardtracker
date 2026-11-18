import { resolveGate, type ChallengeGate } from '@logic/challengeGate'
import { useEffect } from 'react'
import { challengeRepo } from '../db/repositories/challengeRepo'
import { dayEntryRepo } from '../db/repositories/dayEntryRepo'
import { useLiveQuery } from '../db/useLiveQuery'
import { useClock } from './useClock'

export type { ChallengeGate } from '@logic/challengeGate'

/**
 * The current attempt and its days, resolved against today and the clock (at
 * noon an unfinished yesterday turns into a missed day): what the app should
 * show right now. The date and the time come from one reading of the clock.
 * `undefined` while reading, `null` with no attempt at all, in which case
 * attempt #1 is created for a player who has a profile. An attempt whose 75
 * days are done is saved as completed. The web's useChallengeGate.
 */
export function useChallengeGate(): ChallengeGate | null | undefined {
  const { today, nowMin } = useClock()
  const snapshot = useLiveQuery(async () => {
    const challenge = await challengeRepo.getCurrent()
    if (!challenge) return null
    return { challenge, dayEntries: await dayEntryRepo.getAllForChallenge(challenge.id) }
  }, [])

  const needsBootstrap = snapshot === null
  useEffect(() => {
    if (needsBootstrap) void challengeRepo.bootstrapIfEmpty(today)
  }, [needsBootstrap, today])

  const gate = snapshot ? resolveGate(snapshot.challenge, snapshot.dayEntries, today, nowMin) : undefined
  const completedChallengeId = gate?.kind === 'completed' && gate.challenge.status === 'active' ? gate.challenge.id : undefined
  useEffect(() => {
    if (completedChallengeId !== undefined) void challengeRepo.markCompleted(completedChallengeId)
  }, [completedChallengeId])

  // No snapshot yet (undefined) or no attempt at all (null): there is no gate to give.
  return snapshot ? gate : snapshot
}

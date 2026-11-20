import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { challengeRepo } from '../db/repositories/challengeRepo'
import { dayEntryRepo } from '../db/repositories/dayEntryRepo'
import { resolveGate, type ChallengeGate } from '../logic/challengeGate'
import { useNow } from './useNow'

export { canGiveUp, resolveGate, type ChallengeGate, type GateBase } from '../logic/challengeGate'

/**
 * Loads the current challenge and its day entries in one live query and
 * resolves them against `today` (see useToday). Bootstraps attempt #1 when
 * there are no challenges at all, and persists the `completed` status once
 * Day 75 is done. Returns `undefined` while loading.
 */
export function useChallengeGate(today: string): ChallengeGate | undefined {
  // The clock matters too: at noon, an unfinished yesterday turns into a missed day.
  const nowMin = useNow()
  const snapshot = useLiveQuery(async () => {
    const challenge = await challengeRepo.getCurrent()
    if (!challenge) return null
    const dayEntries = await dayEntryRepo.getAllForChallenge(challenge.id)
    return { challenge, dayEntries }
  }, [])

  const needsBootstrap = snapshot === null
  useEffect(() => {
    if (needsBootstrap) void challengeRepo.bootstrapIfEmpty(today)
  }, [needsBootstrap, today])

  const gate = snapshot ? resolveGate(snapshot.challenge, snapshot.dayEntries, today, nowMin) : undefined

  const completedChallengeId =
    gate?.kind === 'completed' && gate.challenge.status === 'active' ? gate.challenge.id : undefined
  useEffect(() => {
    if (completedChallengeId !== undefined) void challengeRepo.markCompleted(completedChallengeId)
  }, [completedChallengeId])

  return gate
}

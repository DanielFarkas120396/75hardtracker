import { resolveGate, type ChallengeGate } from '@logic/challengeGate'
import { useEffect } from 'react'
import { challengeRepo } from '../db/repositories/challengeRepo'
import { dayEntryRepo } from '../db/repositories/dayEntryRepo'
import { useLiveQuery } from '../db/useLiveQuery'
import { useNowMinutes } from './useNowMinutes'
import { useToday } from './useToday'

export type { ChallengeGate } from '@logic/challengeGate'

/**
 * The current attempt and its days, resolved against today and the clock (at
 * noon an unfinished yesterday turns into a missed day): what the app should
 * show right now. `undefined` while reading, `null` with no attempt at all,
 * in which case attempt #1 is created for a player who has a profile. The
 * web's useChallengeGate; marking a finished attempt completed arrives with Victory.
 */
export function useChallengeGate(): ChallengeGate | null | undefined {
  const today = useToday()
  const nowMin = useNowMinutes()
  const snapshot = useLiveQuery(async () => {
    const challenge = await challengeRepo.getCurrent()
    if (!challenge) return null
    return { challenge, dayEntries: await dayEntryRepo.getAllForChallenge(challenge.id) }
  }, [])

  const needsBootstrap = snapshot === null
  useEffect(() => {
    if (needsBootstrap) void challengeRepo.bootstrapIfEmpty(today)
  }, [needsBootstrap, today])

  if (!snapshot) return snapshot
  return resolveGate(snapshot.challenge, snapshot.dayEntries, today, nowMin)
}

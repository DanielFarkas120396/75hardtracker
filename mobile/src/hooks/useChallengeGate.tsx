import { resolveGate, type ChallengeGate } from '@logic/challengeGate'
import { createContext, useContext, useEffect, type ReactNode } from 'react'
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
function useChallengeGate(): ChallengeGate | null | undefined {
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

const NO_PROVIDER = Symbol('no GateProvider')
const GateContext = createContext<ChallengeGate | null | undefined | typeof NO_PROVIDER>(NO_PROVIDER)

/**
 * One gate for the whole app (the web's App.tsx holds one too): Today, Journey and Settings read the same answer,
 * and a finished attempt is saved as completed once. The tabs' layout provides it.
 */
export function GateProvider({ children }: { children: ReactNode }) {
  return <GateContext.Provider value={useChallengeGate()}>{children}</GateContext.Provider>
}

/** The app's gate: `undefined` while reading, `null` with no attempt at all. Needs a GateProvider above it. */
export function useGate(): ChallengeGate | null | undefined {
  const gate = useContext(GateContext)
  if (gate === NO_PROVIDER) throw new Error('useGate needs a GateProvider above it.')
  return gate
}

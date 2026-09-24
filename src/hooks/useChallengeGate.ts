import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { challengeRepo } from '../db/repositories/challengeRepo'
import { dayEntryRepo } from '../db/repositories/dayEntryRepo'
import type { Challenge, DayEntry } from '../db/types'
import { dayNumberForDate } from '../lib/dates'
import { resolveChallengeGate } from '../logic/restart'
import { calculateStreak } from '../logic/streak'

interface GateBase {
  challenge: Challenge
  dayEntries: DayEntry[]
  today: string
  /** Day number of `today` in this challenge: < 1 before it starts, > 75 after it ends, NaN if the start date is broken. */
  todayDayNumber: number
  streak: number
}

/**
 * What the app should show right now:
 * - `active`: the normal screens (including the countdown before Day 1);
 * - `needsRestart`: a day was missed, so the restart flow blocks the app;
 * - `completed`: all 75 days are done — the victory screen.
 */
export type ChallengeGate =
  | (GateBase & { kind: 'active' })
  | (GateBase & { kind: 'needsRestart'; failedDayNumber: number })
  | (GateBase & { kind: 'completed' })

/**
 * Loads the current challenge and its day entries in one live query and
 * resolves them against `today` (see useToday). Bootstraps attempt #1 when
 * there are no challenges at all, and persists the `completed` status once
 * Day 75 is done. Returns `undefined` while loading.
 */
export function useChallengeGate(today: string): ChallengeGate | undefined {
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

  const gate = snapshot ? resolveGate(snapshot.challenge, snapshot.dayEntries, today) : undefined

  const completedChallengeId =
    gate?.kind === 'completed' && gate.challenge.status === 'active' ? gate.challenge.id : undefined
  useEffect(() => {
    if (completedChallengeId !== undefined) void challengeRepo.markCompleted(completedChallengeId)
  }, [completedChallengeId])

  return gate
}

function resolveGate(challenge: Challenge, dayEntries: DayEntry[], today: string): ChallengeGate {
  const todayDayNumber = dayNumberForDate(challenge.startDate, today)
  const summaries = dayEntries.map((e) => ({ dayNumber: e.dayNumber, completed: e.completed }))
  const base: GateBase = {
    challenge,
    dayEntries,
    today,
    todayDayNumber,
    streak: calculateStreak(summaries, todayDayNumber),
  }

  const resolution = resolveChallengeGate({ currentStatus: challenge.status, dayEntries: summaries, todayDayNumber })
  if (resolution.kind === 'needsRestart') {
    return { ...base, kind: 'needsRestart', failedDayNumber: resolution.failedDayNumber ?? 1 }
  }
  return { ...base, kind: resolution.kind }
}

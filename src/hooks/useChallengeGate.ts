import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { challengeRepo } from '../db/repositories/challengeRepo'
import { dayEntryRepo } from '../db/repositories/dayEntryRepo'
import type { Challenge, DayEntry } from '../db/types'
import { dayNumberForDate } from '../lib/dates'
import { resolveChallengeGate } from '../logic/restart'
import { rulesFor } from '../logic/rulesets'
import { calculateStreak } from '../logic/streak'

export interface GateBase {
  challenge: Challenge
  dayEntries: DayEntry[]
  today: string
  /** Day number of `today` in this challenge: < 1 before it starts, > 75 after it ends, NaN if the start date is broken. */
  todayDayNumber: number
  streak: number
  /** Every day missed so far (see missedDayNumbers), whether or not it's been announced yet. */
  missedDays: number[]
  /** Jokers of the ruleset's allowance not yet used by a missed day. */
  jokersLeft: number
}

/**
 * What the app should show right now:
 * - `active`: the normal screens (including the countdown before Day 1);
 * - `needsRestart`: a miss beyond the ruleset's jokers, so the restart flow blocks the app;
 * - `jokerUsed`: a miss that a joker forgave, not yet announced;
 * - `completed`: all 75 days are done — the victory screen;
 * - `abandoned`: the attempt was given up — the "You gave up" screen, until the next one starts.
 */
export type ChallengeGate =
  | (GateBase & { kind: 'active' })
  | (GateBase & { kind: 'needsRestart'; failedDayNumber: number })
  | (GateBase & { kind: 'jokerUsed'; newlyMissed: number[] })
  | (GateBase & { kind: 'completed' })
  | (GateBase & { kind: 'abandoned' })

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

export function resolveGate(challenge: Challenge, dayEntries: DayEntry[], today: string): ChallengeGate {
  const todayDayNumber = dayNumberForDate(challenge.startDate, today)
  const summaries = dayEntries.map((e) => ({ dayNumber: e.dayNumber, completed: e.completed }))
  const rules = rulesFor(challenge)
  const resolution = resolveChallengeGate({
    currentStatus: challenge.status,
    dayEntries: summaries,
    todayDayNumber,
    jokers: rules.jokers,
  })
  const base: GateBase = {
    challenge,
    dayEntries,
    today,
    todayDayNumber,
    streak: calculateStreak(summaries, todayDayNumber),
    missedDays: resolution.missed,
    jokersLeft: Math.max(0, rules.jokers - resolution.missed.length),
  }

  if (resolution.kind === 'needsRestart') {
    return { ...base, kind: 'needsRestart', failedDayNumber: resolution.failedDayNumber ?? 1 }
  }
  const acknowledged = challenge.jokersAcknowledged ?? 0
  if (resolution.kind === 'active' && resolution.missed.length > acknowledged) {
    return { ...base, kind: 'jokerUsed', newlyMissed: resolution.missed.slice(acknowledged) }
  }
  return { ...base, kind: resolution.kind }
}

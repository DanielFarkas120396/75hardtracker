import { dayNumberForDate } from './dates'
import { isChallengeDay } from './days'
import { GRACE_END_MIN, lateDayNumber } from './lateDay'
import type { Challenge, DayEntry } from './records'
import { resolveChallengeGate } from './restart'
import { rulesFor } from './rulesets'
import { withRestoredDays } from './restoredDays'
import { calculateStreak } from './streak'
import type { DayCompletionSummary } from './types'

export interface GateBase {
  challenge: Challenge
  dayEntries: DayEntry[]
  /** Every day as the rules see it, restored days included. */
  daySummaries: DayCompletionSummary[]
  today: string
  /** Day number of `today` in this challenge: < 1 before it starts, > 75 after it ends, NaN if the start date is broken. */
  todayDayNumber: number
  streak: number
  /** Every day missed so far (see missedDayNumbers), whether or not it's been announced yet. */
  missedDays: number[]
  /** Jokers of the ruleset's allowance not yet used by a missed day. */
  jokersLeft: number
  /** Yesterday, while it can still be logged (until noon; see lateDayNumber), done or not. */
  lateDayNumber: number | null
  /** Whether the late day is still unfinished: Today offers to finish it. */
  lateDayPending: boolean
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

/** `nowMin` is minutes since local midnight; left out, it's past noon (no late day). */
export function resolveGate(
  challenge: Challenge,
  dayEntries: DayEntry[],
  today: string,
  nowMin: number = GRACE_END_MIN,
): ChallengeGate {
  const todayDayNumber = dayNumberForDate(challenge.startDate, today)
  const lateDay = challenge.status === 'active' ? lateDayNumber(todayDayNumber, nowMin) : null
  const summaries = withRestoredDays(
    dayEntries.map((e) => ({ dayNumber: e.dayNumber, completed: e.completed })),
    challenge.restoredDays,
  )
  const rules = rulesFor(challenge)
  const resolution = resolveChallengeGate({
    currentStatus: challenge.status,
    dayEntries: summaries,
    todayDayNumber,
    jokers: rules.jokers,
    lateDay,
  })
  const base: GateBase = {
    challenge,
    dayEntries,
    daySummaries: summaries,
    today,
    todayDayNumber,
    streak: calculateStreak(summaries, todayDayNumber, lateDay),
    missedDays: resolution.missed,
    jokersLeft: Math.max(0, rules.jokers - resolution.missed.length),
    lateDayNumber: lateDay,
    lateDayPending: lateDay !== null && !summaries.some((e) => e.dayNumber === lateDay && e.completed),
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

/** Whether the attempt can be given up now: the normal screens are showing and today is Day 1–75. */
export function canGiveUp(gate: ChallengeGate): boolean {
  return gate.kind === 'active' && isChallengeDay(gate.todayDayNumber)
}

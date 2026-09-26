/** The four challenges an attempt can be, hardest first. */
export type ChallengeVariant = 'hard' | 'strong' | 'medium' | 'soft'

/**
 * Every rule that differs between the challenges. The table is in section 2
 * of docs/superpowers/specs/2026-09-26-challenge-variants-design.md.
 */
export interface Ruleset {
  readonly variant: ChallengeVariant
  /** Qualifying workouts needed each day. */
  readonly requiredWorkouts: number
  /** Whether one of the qualifying workouts must be outdoors. */
  readonly requireOutdoor: boolean
  /** The minutes a workout needs to qualify. */
  readonly minWorkoutMin: number
  readonly waterTargetMl: number
  readonly pagesTarget: number
  /** Recovery days allowed per challenge week (the workouts task counts as done). */
  readonly restDaysPerWeek: number
  /** Declared social occasions allowed per challenge week (a drink is allowed). */
  readonly socialDaysPerWeek: number
  /** Missed days forgiven before the attempt fails. */
  readonly jokers: number
  readonly dietKind: 'strict' | 'healthy'
  readonly readingKind: 'non-fiction' | 'any'
}

export const VARIANTS: readonly ChallengeVariant[] = ['hard', 'strong', 'medium', 'soft']

const HARD: Ruleset = {
  variant: 'hard',
  requiredWorkouts: 2,
  requireOutdoor: true,
  minWorkoutMin: 45,
  waterTargetMl: 3800,
  pagesTarget: 10,
  restDaysPerWeek: 0,
  socialDaysPerWeek: 0,
  jokers: 0,
  dietKind: 'strict',
  readingKind: 'non-fiction',
}

const MEDIUM: Ruleset = {
  variant: 'medium',
  requiredWorkouts: 1,
  requireOutdoor: false,
  minWorkoutMin: 45,
  waterTargetMl: 3000,
  pagesTarget: 10,
  restDaysPerWeek: 0,
  socialDaysPerWeek: 1,
  jokers: 1,
  dietKind: 'healthy',
  readingKind: 'any',
}

export const RULESETS: Readonly<Record<ChallengeVariant, Ruleset>> = {
  hard: HARD,
  strong: { ...HARD, variant: 'strong', socialDaysPerWeek: 1 },
  medium: MEDIUM,
  soft: { ...MEDIUM, variant: 'soft', restDaysPerWeek: 1, jokers: 3 },
}

export function isChallengeVariant(value: unknown): value is ChallengeVariant {
  return typeof value === 'string' && (VARIANTS as readonly string[]).includes(value)
}

/** A challenge's variant. Missing or unknown means 75 Hard: every attempt made before variants existed. */
export function variantOf(challenge: { variant?: unknown }): ChallengeVariant {
  return isChallengeVariant(challenge.variant) ? challenge.variant : 'hard'
}

/** The rules a challenge is judged by. */
export function rulesFor(challenge: { variant?: unknown }): Ruleset {
  return RULESETS[variantOf(challenge)]
}

/** The challenge week of a day: days 1–7 are week 1, …, days 71–75 week 11. */
export function challengeWeek(dayNumber: number): number {
  return Math.ceil(dayNumber / 7)
}

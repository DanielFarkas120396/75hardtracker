import type { DuckMood } from './duckRig'

/** A screen of the welcome flow. */
export type OnboardingStep = 'welcome' | 'name' | 'challenge' | 'why' | 'bedtime' | 'start' | 'ready'

/** 'new': no attempts yet, so the flow also picks the challenge and its start. 'returning': attempts exist already. */
export type OnboardingMode = 'new' | 'returning'

/**
 * The welcome flow's screens, in order. A returning player keeps the attempts
 * they have, so they skip the challenge, the bedtime (already set) and the start date. A paywall, one
 * day, would go right before 'ready'.
 */
export function onboardingSteps(mode: OnboardingMode): OnboardingStep[] {
  return mode === 'new'
    ? ['welcome', 'name', 'challenge', 'why', 'bedtime', 'start', 'ready']
    : ['welcome', 'name', 'why', 'ready']
}

/**
 * Where a restored draft reopens: its saved step, or the first step before it
 * whose answer is missing or no longer valid (a start date now in the past),
 * so the player never lands on a screen they can't get past.
 */
export function resumeStep(
  steps: readonly OnboardingStep[],
  saved: OnboardingStep,
  ok: Partial<Record<OnboardingStep, boolean>>,
): number {
  const savedIndex = Math.max(steps.indexOf(saved), 0)
  const firstUnanswered = steps.findIndex((step, i) => i < savedIndex && ok[step] === false)
  return firstUnanswered === -1 ? savedIndex : firstUnanswered
}

export const STEP_MOODS: Record<OnboardingStep, DuckMood> = {
  welcome: 'content',
  name: 'watching',
  challenge: 'tapping',
  why: 'watching',
  bedtime: 'watching',
  start: 'waiting',
  ready: 'judging',
}

/** The steps with the most content: a smaller duck keeps their button in reach. */
export const LONG_STEPS: ReadonlySet<OnboardingStep> = new Set(['challenge', 'ready'])

/** How long the duck holds the signed deal before the app takes over. */
export const SIGNED_BEAT_MS = 1200

/** From this length on, the why field shows how much room is left. */
export const WHY_COUNTER_FROM = 100

/** Past this length, the reason on the deal is set a size smaller, so it doesn't fill the card. */
export const LONG_REASON_FROM = 60

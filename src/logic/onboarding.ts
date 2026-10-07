/** A screen of the welcome flow. */
export type OnboardingStep = 'welcome' | 'name' | 'challenge' | 'why' | 'start' | 'ready'

/** 'new': no attempts yet, so the flow also picks the challenge and its start. 'returning': attempts exist already. */
export type OnboardingMode = 'new' | 'returning'

/**
 * The welcome flow's screens, in order. A returning player keeps the attempts
 * they have, so they skip the challenge and its start date. A paywall, one
 * day, would go right before 'ready'.
 */
export function onboardingSteps(mode: OnboardingMode): OnboardingStep[] {
  return mode === 'new'
    ? ['welcome', 'name', 'challenge', 'why', 'start', 'ready']
    : ['welcome', 'name', 'why', 'ready']
}

/** Which of a saved draft's answers can still be used. */
export interface DraftAnswers {
  nameOk: boolean
  variantOk: boolean
  whyOk: boolean
  dateOk: boolean
}

/**
 * Where a restored draft reopens: its saved step, or the first step before it
 * whose answer is missing or no longer valid (a start date now in the past),
 * so the player never lands on a screen they can't get past.
 */
export function resumeStep(steps: readonly OnboardingStep[], saved: OnboardingStep, answers: DraftAnswers): number {
  const savedIndex = Math.max(steps.indexOf(saved), 0)
  const ok: Partial<Record<OnboardingStep, boolean>> = {
    name: answers.nameOk,
    challenge: answers.variantOk,
    why: answers.whyOk,
    start: answers.dateOk,
  }
  const firstUnanswered = steps.findIndex((step, i) => i < savedIndex && ok[step] === false)
  return firstUnanswered === -1 ? savedIndex : firstUnanswered
}

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

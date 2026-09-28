import { describe, expect, it } from 'vitest'
import { onboardingSteps } from '../onboarding'

describe('onboardingSteps', () => {
  it('walks a new player through the challenge and its start', () => {
    expect(onboardingSteps('new')).toEqual(['welcome', 'name', 'challenge', 'why', 'start', 'ready'])
  })

  it('skips the challenge and the start for a returning player, whose attempts stay as they are', () => {
    expect(onboardingSteps('returning')).toEqual(['welcome', 'name', 'why', 'ready'])
  })
})

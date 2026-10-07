import { describe, expect, it } from 'vitest'
import { onboardingSteps, resumeStep, type DraftAnswers } from '../onboarding'

const allOk: DraftAnswers = { nameOk: true, variantOk: true, whyOk: true, dateOk: true }

describe('resumeStep', () => {
  const steps = onboardingSteps('new')

  it('reopens on the saved step when every answer before it still holds', () => {
    expect(resumeStep(steps, 'ready', allOk)).toBe(steps.indexOf('ready'))
    expect(resumeStep(steps, 'why', { ...allOk, whyOk: false })).toBe(steps.indexOf('why'))
  })

  it('goes back to the first step whose answer is missing or no longer valid', () => {
    expect(resumeStep(steps, 'ready', { ...allOk, nameOk: false, whyOk: false })).toBe(steps.indexOf('name'))
    expect(resumeStep(steps, 'ready', { ...allOk, variantOk: false })).toBe(steps.indexOf('challenge'))
    expect(resumeStep(steps, 'ready', { ...allOk, whyOk: false })).toBe(steps.indexOf('why'))
    expect(resumeStep(steps, 'ready', { ...allOk, dateOk: false })).toBe(steps.indexOf('start'))
  })

  it('ignores the steps a returning player skips', () => {
    const returning = onboardingSteps('returning')
    expect(resumeStep(returning, 'ready', { ...allOk, variantOk: false, dateOk: false })).toBe(returning.indexOf('ready'))
  })

  it('falls back to the first screen for a step this mode has no screen for', () => {
    expect(resumeStep(onboardingSteps('returning'), 'start', allOk)).toBe(0)
  })
})

describe('onboardingSteps', () => {
  it('walks a new player through the challenge and its start', () => {
    expect(onboardingSteps('new')).toEqual(['welcome', 'name', 'challenge', 'why', 'start', 'ready'])
  })

  it('skips the challenge and the start for a returning player, whose attempts stay as they are', () => {
    expect(onboardingSteps('returning')).toEqual(['welcome', 'name', 'why', 'ready'])
  })
})

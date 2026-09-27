import { describe, expect, it } from 'vitest'
import { challengeWeek, cleanSocialDays, isChallengeVariant, RULESETS, rulesFor, variantOf, VARIANTS } from '../rulesets'

describe('rulesets', () => {
  it('keeps 75 Hard exactly as it was', () => {
    expect(RULESETS.hard).toEqual({
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
    })
  })

  it('makes 75 Strong a 75 Hard with one social occasion a week', () => {
    expect(RULESETS.strong).toEqual({ ...RULESETS.hard, variant: 'strong', socialDaysPerWeek: 1 })
  })

  it('gives Medium one workout, 3 L, any book, a social occasion a week and one joker', () => {
    expect(RULESETS.medium).toEqual({
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
    })
  })

  it('makes Soft a Medium with a recovery day a week and three jokers', () => {
    expect(RULESETS.soft).toEqual({ ...RULESETS.medium, variant: 'soft', restDaysPerWeek: 1, jokers: 3 })
  })

  it('lists the variants from hardest to softest', () => {
    expect(VARIANTS).toEqual(['hard', 'strong', 'medium', 'soft'])
  })

  it('treats a missing or unknown variant as 75 Hard', () => {
    expect(variantOf({})).toBe('hard')
    expect(variantOf({ variant: undefined })).toBe('hard')
    expect(variantOf({ variant: 'extreme' })).toBe('hard')
    expect(variantOf({ variant: 42 })).toBe('hard')
    expect(variantOf({ variant: 'soft' })).toBe('soft')
    expect(rulesFor({ variant: 'medium' })).toBe(RULESETS.medium)
    expect(rulesFor({})).toBe(RULESETS.hard)
  })

  it('recognises the four variant ids only', () => {
    for (const variant of VARIANTS) expect(isChallengeVariant(variant)).toBe(true)
    expect(isChallengeVariant('Hard')).toBe(false)
    expect(isChallengeVariant(null)).toBe(false)
  })

  it('groups days into challenge weeks of seven, the last one short', () => {
    expect(challengeWeek(1)).toBe(1)
    expect(challengeWeek(7)).toBe(1)
    expect(challengeWeek(8)).toBe(2)
    expect(challengeWeek(70)).toBe(10)
    expect(challengeWeek(71)).toBe(11)
    expect(challengeWeek(75)).toBe(11)
  })

  it('cleanSocialDays sorts, de-duplicates, drops days outside 1–75 and keeps the earliest per week', () => {
    expect(cleanSocialDays([9, 0, 2, 3, 76, 2])).toEqual([2, 9])
  })
})

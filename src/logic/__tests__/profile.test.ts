import { describe, expect, it } from 'vitest'
import { cleanText, isValidName, isValidWhy, NAME_MAX_LENGTH, parseProfile, WHY_MAX_LENGTH } from '../profile'

describe('cleanText', () => {
  it('trims and collapses inner whitespace', () => {
    expect(cleanText('  Daniel   F.  ')).toBe('Daniel F.')
    expect(cleanText('Get\n fit')).toBe('Get fit')
  })
})

describe('isValidName', () => {
  it('needs 1 to 20 characters once cleaned', () => {
    expect(isValidName('Daniel')).toBe(true)
    expect(isValidName('   ')).toBe(false)
    expect(isValidName('x'.repeat(NAME_MAX_LENGTH))).toBe(true)
    expect(isValidName('x'.repeat(NAME_MAX_LENGTH + 1))).toBe(false)
  })
})

describe('isValidWhy', () => {
  it('needs 1 to 140 characters once cleaned', () => {
    expect(isValidWhy('A fresh start')).toBe(true)
    expect(isValidWhy('')).toBe(false)
    expect(isValidWhy('x'.repeat(WHY_MAX_LENGTH))).toBe(true)
    expect(isValidWhy('x'.repeat(WHY_MAX_LENGTH + 1))).toBe(false)
  })
})

describe('parseProfile', () => {
  const onboardedAt = '2026-09-28T08:00:00.000Z'

  it('returns a stored profile, cleaned', () => {
    expect(parseProfile({ name: ' Daniel ', why: 'Build  real discipline', onboardedAt })).toEqual({
      name: 'Daniel',
      why: 'Build real discipline',
      onboardedAt,
    })
  })

  it('ignores anything unusable', () => {
    expect(parseProfile(undefined)).toBeUndefined()
    expect(parseProfile('Daniel')).toBeUndefined()
    expect(parseProfile({ name: '', why: 'x', onboardedAt })).toBeUndefined()
    expect(parseProfile({ name: 'Daniel', why: 'x' })).toBeUndefined()
    expect(parseProfile({ name: 'Daniel', why: 'x'.repeat(WHY_MAX_LENGTH + 1), onboardedAt })).toBeUndefined()
  })
})

import { describe, expect, it } from 'vitest'
import { daysUntilStart, isChallengeDay } from '../days'

describe('isChallengeDay', () => {
  it('accepts whole day numbers from 1 to 75', () => {
    expect(isChallengeDay(1)).toBe(true)
    expect(isChallengeDay(40)).toBe(true)
    expect(isChallengeDay(75)).toBe(true)
  })

  it('rejects days before the start, after the end, fractions and NaN', () => {
    expect(isChallengeDay(0)).toBe(false)
    expect(isChallengeDay(-2)).toBe(false)
    expect(isChallengeDay(76)).toBe(false)
    expect(isChallengeDay(1.5)).toBe(false)
    expect(isChallengeDay(Number.NaN)).toBe(false)
  })
})

describe('daysUntilStart', () => {
  it('counts down to Day 1 before the start', () => {
    expect(daysUntilStart(0)).toBe(1)
    expect(daysUntilStart(-4)).toBe(5)
  })

  it('is 0 once the challenge has started, or for a broken day number', () => {
    expect(daysUntilStart(1)).toBe(0)
    expect(daysUntilStart(30)).toBe(0)
    expect(daysUntilStart(Number.NaN)).toBe(0)
  })
})

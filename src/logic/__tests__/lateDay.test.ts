import { describe, expect, it } from 'vitest'
import { GRACE_END_MIN, lateDayNumber } from '../lateDay'
import { evaluateChallenge, missedDayNumbers, resolveChallengeGate } from '../restart'
import { calculateStreak } from '../streak'

const done = (...days: number[]) => days.map((dayNumber) => ({ dayNumber, completed: true }))
const MORNING = 9 * 60
const AFTERNOON = 13 * 60

describe('lateDayNumber', () => {
  it('keeps yesterday open until noon', () => {
    expect(GRACE_END_MIN).toBe(12 * 60)
    expect(lateDayNumber(5, MORNING)).toBe(4)
    expect(lateDayNumber(5, GRACE_END_MIN - 1)).toBe(4)
    expect(lateDayNumber(5, GRACE_END_MIN)).toBeNull()
    expect(lateDayNumber(5, AFTERNOON)).toBeNull()
  })

  it('has no late day on Day 1, before the start or after Day 76', () => {
    expect(lateDayNumber(1, MORNING)).toBeNull()
    expect(lateDayNumber(-2, MORNING)).toBeNull()
    expect(lateDayNumber(76, MORNING)).toBe(75)
    expect(lateDayNumber(77, MORNING)).toBeNull()
    expect(lateDayNumber(Number.NaN, MORNING)).toBeNull()
  })
})

describe('missed days with a late day', () => {
  it("doesn't count an unfinished late day as missed, but still counts older gaps", () => {
    expect(missedDayNumbers(done(1, 2), 4, 3)).toEqual([])
    expect(missedDayNumbers(done(1), 4, 3)).toEqual([2])
    expect(missedDayNumbers(done(1, 2), 4, null)).toEqual([3])
  })

  it('keeps a 75 Hard attempt alive in the morning, and fails it at noon', () => {
    const entries = done(1, 2)
    expect(evaluateChallenge({ currentStatus: 'active', dayEntries: entries, todayDayNumber: 4, jokers: 0, lateDay: 3 }).status).toBe(
      'active',
    )
    expect(evaluateChallenge({ currentStatus: 'active', dayEntries: entries, todayDayNumber: 4, jokers: 0, lateDay: null })).toMatchObject({
      status: 'failed',
      failedDayNumber: 3,
    })
  })

  it('waits for noon on Day 76 before calling an unfinished Day 75', () => {
    const allButLast = done(...Array.from({ length: 74 }, (_, i) => i + 1))
    const params = { currentStatus: 'active' as const, dayEntries: allButLast, todayDayNumber: 76, jokers: 0 }
    expect(resolveChallengeGate({ ...params, lateDay: 75 }).kind).toBe('active')
    expect(resolveChallengeGate({ ...params, lateDay: null }).kind).toBe('needsRestart')
    expect(resolveChallengeGate({ ...params, dayEntries: [...allButLast, ...done(75)], lateDay: 75 }).kind).toBe('completed')
  })
})

describe('streak with a late day', () => {
  it("doesn't drop the flame while yesterday can still be finished", () => {
    const entries = done(1, 2, 3)
    expect(calculateStreak(entries, 5, 4)).toBe(3)
    expect(calculateStreak(entries, 5, null)).toBe(0)
    expect(calculateStreak([...entries, ...done(4)], 5, 4)).toBe(4)
  })
})

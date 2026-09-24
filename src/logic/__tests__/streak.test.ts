import { describe, expect, it } from 'vitest'
import { calculateStreak, streakEndingAt } from '../streak'

const completedDays = (...days: number[]) => days.map((dayNumber) => ({ dayNumber, completed: true }))

describe('streakEndingAt', () => {
  it('counts consecutive completed days ending at the given day', () => {
    expect(streakEndingAt(completedDays(1, 2, 3), 3)).toBe(3)
  })

  it('is 0 when the given day is not complete', () => {
    expect(streakEndingAt([...completedDays(1, 2), { dayNumber: 3, completed: false }], 3)).toBe(0)
  })

  it('is 0 when the given day has no entry', () => {
    expect(streakEndingAt(completedDays(1, 2), 3)).toBe(0)
  })

  it('stops at the first gap', () => {
    expect(streakEndingAt(completedDays(1, 3, 4), 4)).toBe(2)
  })

  it('is 0 for day numbers below 1 or not finite', () => {
    expect(streakEndingAt(completedDays(1), 0)).toBe(0)
    expect(streakEndingAt(completedDays(1), Number.NaN)).toBe(0)
  })
})

describe('calculateStreak', () => {
  it('is 0 for no entries', () => {
    expect(calculateStreak([], 1)).toBe(0)
  })

  it('counts through today once today is complete', () => {
    expect(calculateStreak(completedDays(1, 2, 3, 4), 4)).toBe(4)
  })

  it("keeps yesterday's streak while today is still in progress", () => {
    expect(calculateStreak([...completedDays(1, 2, 3), { dayNumber: 4, completed: false }], 4)).toBe(3)
  })

  it("shows yesterday's streak on a new morning before today's entry exists", () => {
    expect(calculateStreak(completedDays(1, 2, 3), 4)).toBe(3)
  })

  it('is 0 on Day 1 before anything is complete', () => {
    expect(calculateStreak([{ dayNumber: 1, completed: false }], 1)).toBe(0)
  })

  it('is 0 when both today and yesterday are incomplete', () => {
    expect(
      calculateStreak(
        [...completedDays(1), { dayNumber: 2, completed: false }, { dayNumber: 3, completed: false }],
        3,
      ),
    ).toBe(0)
  })

  it('counts only the run ending yesterday when there is an earlier gap', () => {
    expect(calculateStreak([...completedDays(1, 2, 4), { dayNumber: 5, completed: false }], 5)).toBe(1)
  })

  it('is 0 before the challenge starts', () => {
    expect(calculateStreak([], 0)).toBe(0)
    expect(calculateStreak([], -3)).toBe(0)
    expect(calculateStreak([], Number.NaN)).toBe(0)
  })

  it('counts from the final day once the challenge is over', () => {
    const all75 = Array.from({ length: 75 }, (_, i) => ({ dayNumber: i + 1, completed: true }))
    expect(calculateStreak(all75, 80)).toBe(75)
  })

  it('does not depend on input order', () => {
    expect(calculateStreak(completedDays(3, 1, 2), 3)).toBe(3)
  })
})

import { describe, expect, it } from 'vitest'
import { calculateStreak } from '../streak'

describe('calculateStreak', () => {
  it('is 0 for no entries', () => {
    expect(calculateStreak([])).toBe(0)
  })

  it('counts consecutive completed days ending at the latest day', () => {
    expect(
      calculateStreak([
        { dayNumber: 1, completed: true },
        { dayNumber: 2, completed: true },
        { dayNumber: 3, completed: true },
      ]),
    ).toBe(3)
  })

  it('stops counting at the most recent incomplete day', () => {
    expect(
      calculateStreak([
        { dayNumber: 1, completed: true },
        { dayNumber: 2, completed: false },
        { dayNumber: 3, completed: true },
        { dayNumber: 4, completed: true },
      ]),
    ).toBe(2)
  })

  it('is 0 when the latest day is incomplete', () => {
    expect(
      calculateStreak([
        { dayNumber: 1, completed: true },
        { dayNumber: 2, completed: false },
      ]),
    ).toBe(0)
  })

  it('does not depend on input order', () => {
    expect(
      calculateStreak([
        { dayNumber: 3, completed: true },
        { dayNumber: 1, completed: true },
        { dayNumber: 2, completed: true },
      ]),
    ).toBe(3)
  })
})

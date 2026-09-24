import { describe, expect, it } from 'vitest'
import { buildRestartedChallenge, evaluateChallengeStatus, findFirstIncompleteDayNumber } from '../restart'

describe('evaluateChallengeStatus', () => {
  it('passes through a non-active status unchanged', () => {
    expect(
      evaluateChallengeStatus({ currentStatus: 'failed', dayEntries: [], todayDayNumber: 5 }),
    ).toBe('failed')
  })

  it('stays active when every prior day is complete', () => {
    expect(
      evaluateChallengeStatus({
        currentStatus: 'active',
        dayEntries: [
          { dayNumber: 1, completed: true },
          { dayNumber: 2, completed: true },
        ],
        todayDayNumber: 3,
      }),
    ).toBe('active')
  })

  it('fails when a prior day is explicitly incomplete', () => {
    expect(
      evaluateChallengeStatus({
        currentStatus: 'active',
        dayEntries: [
          { dayNumber: 1, completed: true },
          { dayNumber: 2, completed: false },
        ],
        todayDayNumber: 3,
      }),
    ).toBe('failed')
  })

  it('fails when a prior day has no entry at all (app never opened that day)', () => {
    expect(
      evaluateChallengeStatus({
        currentStatus: 'active',
        dayEntries: [{ dayNumber: 1, completed: true }],
        // day 2 is missing entirely
        todayDayNumber: 3,
      }),
    ).toBe('failed')
  })

  it('does not require today itself to be complete', () => {
    expect(
      evaluateChallengeStatus({
        currentStatus: 'active',
        dayEntries: [
          { dayNumber: 1, completed: true },
          { dayNumber: 2, completed: false },
        ],
        todayDayNumber: 2,
      }),
    ).toBe('active')
  })

  it('completes the challenge once day 75 is complete and today is day 75 or later', () => {
    const dayEntries = Array.from({ length: 75 }, (_, i) => ({ dayNumber: i + 1, completed: true }))
    expect(evaluateChallengeStatus({ currentStatus: 'active', dayEntries, todayDayNumber: 75 })).toBe('completed')
  })
})

describe('findFirstIncompleteDayNumber', () => {
  it('returns undefined when every prior day is complete', () => {
    expect(
      findFirstIncompleteDayNumber([{ dayNumber: 1, completed: true }, { dayNumber: 2, completed: true }], 3),
    ).toBeUndefined()
  })

  it('returns the earliest incomplete or missing day', () => {
    expect(
      findFirstIncompleteDayNumber(
        [
          { dayNumber: 1, completed: true },
          { dayNumber: 3, completed: false },
        ],
        4,
      ),
    ).toBe(2)
  })
})

describe('buildRestartedChallenge', () => {
  it('increments the attempt number and resets to active with the given start date', () => {
    expect(buildRestartedChallenge({ attemptNumber: 1 }, '2026-01-15')).toEqual({
      startDate: '2026-01-15',
      attemptNumber: 2,
      status: 'active',
    })
  })
})

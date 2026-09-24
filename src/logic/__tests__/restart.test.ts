import { describe, expect, it } from 'vitest'
import {
  buildNextChallenge,
  evaluateChallengeStatus,
  findFirstIncompleteDayNumber,
  nextAttemptNumber,
  resolveChallengeGate,
} from '../restart'

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

describe('nextAttemptNumber', () => {
  it('is 1 when there are no attempts yet', () => {
    expect(nextAttemptNumber([])).toBe(1)
  })

  it('is one more than the highest attempt, regardless of order or gaps', () => {
    expect(nextAttemptNumber([1, 3, 2])).toBe(4)
    expect(nextAttemptNumber([5])).toBe(6)
  })
})

describe('buildNextChallenge', () => {
  it('builds an active challenge with the next attempt number and the given start date', () => {
    expect(buildNextChallenge([1, 2], '2026-01-15')).toEqual({
      startDate: '2026-01-15',
      attemptNumber: 3,
      status: 'active',
    })
  })

  it('builds attempt #1 on first launch', () => {
    expect(buildNextChallenge([], '2026-01-15').attemptNumber).toBe(1)
  })
})

describe('resolveChallengeGate', () => {
  const completeDays = (n: number) => Array.from({ length: n }, (_, i) => ({ dayNumber: i + 1, completed: true }))

  it('is active while every earlier day is complete', () => {
    expect(resolveChallengeGate({ currentStatus: 'active', dayEntries: completeDays(2), todayDayNumber: 3 })).toEqual({
      kind: 'active',
    })
  })

  it('is active before the challenge has started', () => {
    expect(resolveChallengeGate({ currentStatus: 'active', dayEntries: [], todayDayNumber: -2 })).toEqual({
      kind: 'active',
    })
  })

  it('needs a restart, naming the first missed day, once a day was missed', () => {
    expect(
      resolveChallengeGate({
        currentStatus: 'active',
        dayEntries: [...completeDays(2), { dayNumber: 3, completed: false }],
        todayDayNumber: 5,
      }),
    ).toEqual({ kind: 'needsRestart', failedDayNumber: 3 })
  })

  it('needs a restart for an attempt that is already archived as failed', () => {
    expect(
      resolveChallengeGate({
        currentStatus: 'failed',
        dayEntries: [{ dayNumber: 1, completed: false }],
        todayDayNumber: 40,
      }),
    ).toEqual({ kind: 'needsRestart', failedDayNumber: 1 })
  })

  it('is completed once Day 75 is complete, on Day 75 itself and afterwards', () => {
    expect(
      resolveChallengeGate({ currentStatus: 'active', dayEntries: completeDays(75), todayDayNumber: 75 }).kind,
    ).toBe('completed')
    expect(
      resolveChallengeGate({ currentStatus: 'completed', dayEntries: completeDays(75), todayDayNumber: 90 }).kind,
    ).toBe('completed')
  })
})

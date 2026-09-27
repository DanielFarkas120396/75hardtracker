import { describe, expect, it } from 'vitest'
import {
  buildNextChallenge,
  evaluateChallenge,
  missedDayNumbers,
  nextAttemptNumber,
  resolveChallengeGate,
} from '../restart'

describe('evaluateChallenge', () => {
  it('passes through a non-active status unchanged', () => {
    expect(
      evaluateChallenge({ currentStatus: 'failed', dayEntries: [], todayDayNumber: 5, jokers: 0 }).status,
    ).toBe('failed')
  })

  it('stays active when every prior day is complete', () => {
    expect(
      evaluateChallenge({
        currentStatus: 'active',
        dayEntries: [
          { dayNumber: 1, completed: true },
          { dayNumber: 2, completed: true },
        ],
        todayDayNumber: 3,
        jokers: 0,
      }).status,
    ).toBe('active')
  })

  it('fails when a prior day is explicitly incomplete', () => {
    expect(
      evaluateChallenge({
        currentStatus: 'active',
        dayEntries: [
          { dayNumber: 1, completed: true },
          { dayNumber: 2, completed: false },
        ],
        todayDayNumber: 3,
        jokers: 0,
      }).status,
    ).toBe('failed')
  })

  it('fails when a prior day has no entry at all (app never opened that day)', () => {
    expect(
      evaluateChallenge({
        currentStatus: 'active',
        dayEntries: [{ dayNumber: 1, completed: true }],
        // day 2 is missing entirely
        todayDayNumber: 3,
        jokers: 0,
      }).status,
    ).toBe('failed')
  })

  it('does not require today itself to be complete', () => {
    expect(
      evaluateChallenge({
        currentStatus: 'active',
        dayEntries: [
          { dayNumber: 1, completed: true },
          { dayNumber: 2, completed: false },
        ],
        todayDayNumber: 2,
        jokers: 0,
      }).status,
    ).toBe('active')
  })

  it('completes the challenge once day 75 is complete and today is day 75 or later', () => {
    const dayEntries = Array.from({ length: 75 }, (_, i) => ({ dayNumber: i + 1, completed: true }))
    expect(evaluateChallenge({ currentStatus: 'active', dayEntries, todayDayNumber: 75, jokers: 0 }).status).toBe(
      'completed',
    )
  })
})

describe('missedDayNumbers', () => {
  it('has no missed day when every earlier day is complete', () => {
    expect(
      missedDayNumbers([{ dayNumber: 1, completed: true }, { dayNumber: 2, completed: true }], 3),
    ).toEqual([])
  })

  it('lists incomplete and missing days, earliest first', () => {
    expect(
      missedDayNumbers(
        [
          { dayNumber: 1, completed: true },
          { dayNumber: 3, completed: false },
        ],
        4,
      ),
    ).toEqual([2, 3])
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
    expect(buildNextChallenge([1, 2], '2026-01-15', 'hard')).toEqual({
      startDate: '2026-01-15',
      attemptNumber: 3,
      status: 'active',
      variant: 'hard',
    })
  })

  it('builds attempt #1 on first launch', () => {
    expect(buildNextChallenge([], '2026-01-15', 'hard').attemptNumber).toBe(1)
  })

  it('carries the given variant', () => {
    expect(buildNextChallenge([1, 2], '2026-10-01', 'medium')).toEqual({
      startDate: '2026-10-01',
      attemptNumber: 3,
      status: 'active',
      variant: 'medium',
    })
  })
})

describe('resolveChallengeGate', () => {
  const completeDays = (n: number) => Array.from({ length: n }, (_, i) => ({ dayNumber: i + 1, completed: true }))

  it('is active while every earlier day is complete', () => {
    expect(
      resolveChallengeGate({ currentStatus: 'active', dayEntries: completeDays(2), todayDayNumber: 3, jokers: 0 }),
    ).toEqual({
      kind: 'active',
    })
  })

  it('is active before the challenge has started', () => {
    expect(resolveChallengeGate({ currentStatus: 'active', dayEntries: [], todayDayNumber: -2, jokers: 0 })).toEqual({
      kind: 'active',
    })
  })

  it('needs a restart, naming the first missed day, once a day was missed', () => {
    expect(
      resolveChallengeGate({
        currentStatus: 'active',
        dayEntries: [...completeDays(2), { dayNumber: 3, completed: false }],
        todayDayNumber: 5,
        jokers: 0,
      }),
    ).toEqual({ kind: 'needsRestart', failedDayNumber: 3 })
  })

  it('needs a restart for an attempt that is already archived as failed', () => {
    expect(
      resolveChallengeGate({
        currentStatus: 'failed',
        dayEntries: [{ dayNumber: 1, completed: false }],
        todayDayNumber: 40,
        jokers: 0,
      }),
    ).toEqual({ kind: 'needsRestart', failedDayNumber: 1 })
  })

  it('finds the first incomplete day for an archived failed attempt even when the start date is broken', () => {
    expect(
      resolveChallengeGate({
        currentStatus: 'failed',
        dayEntries: [
          { dayNumber: 1, completed: true },
          { dayNumber: 2, completed: false },
        ],
        todayDayNumber: Number.NaN,
        jokers: 0,
      }),
    ).toEqual({ kind: 'needsRestart', failedDayNumber: 2 })
  })

  it('is completed once Day 75 is complete, on Day 75 itself and afterwards', () => {
    expect(
      resolveChallengeGate({ currentStatus: 'active', dayEntries: completeDays(75), todayDayNumber: 75, jokers: 0 })
        .kind,
    ).toBe('completed')
    expect(
      resolveChallengeGate({ currentStatus: 'completed', dayEntries: completeDays(75), todayDayNumber: 90, jokers: 0 })
        .kind,
    ).toBe('completed')
  })
})

const complete = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => ({ dayNumber: from + i, completed: true }))

describe('missed days and jokers', () => {
  it('never counts past Day 75: a complete attempt first opened on Day 77 is complete', () => {
    const result = evaluateChallenge({ currentStatus: 'active', dayEntries: complete(1, 75), todayDayNumber: 77, jokers: 0 })
    expect(result).toEqual({ status: 'completed', missed: [] })
  })

  it('lists the missed days before today', () => {
    const entries = [...complete(1, 3), { dayNumber: 4, completed: false }, ...complete(6, 7)]
    expect(missedDayNumbers(entries, 8)).toEqual([4, 5])
    expect(missedDayNumbers(entries, 1)).toEqual([])
    expect(missedDayNumbers(entries, Number.NaN)).toEqual([])
  })

  it('forgives misses up to the joker count, and fails on the next one', () => {
    const oneMiss = [...complete(1, 2), { dayNumber: 3, completed: false }, ...complete(4, 5)]
    expect(evaluateChallenge({ currentStatus: 'active', dayEntries: oneMiss, todayDayNumber: 6, jokers: 1 })).toEqual({
      status: 'active',
      missed: [3],
    })
    const twoMisses = [...oneMiss, { dayNumber: 6, completed: false }]
    expect(evaluateChallenge({ currentStatus: 'active', dayEntries: twoMisses, todayDayNumber: 7, jokers: 1 })).toEqual({
      status: 'failed',
      missed: [3, 6],
      failedDayNumber: 6,
    })
  })

  it('fails 75 Hard on the first miss, as before', () => {
    const entries = [...complete(1, 2), { dayNumber: 3, completed: false }]
    expect(evaluateChallenge({ currentStatus: 'active', dayEntries: entries, todayDayNumber: 4, jokers: 0 })).toEqual({
      status: 'failed',
      missed: [3],
      failedDayNumber: 3,
    })
  })

  it('completes after Day 75 when a joker covered a missed Day 75', () => {
    const entries = [...complete(1, 74), { dayNumber: 75, completed: false }]
    expect(evaluateChallenge({ currentStatus: 'active', dayEntries: entries, todayDayNumber: 76, jokers: 3 })).toEqual({
      status: 'completed',
      missed: [75],
    })
  })

  it('stays active on Day 75 until Day 75 is complete', () => {
    expect(evaluateChallenge({ currentStatus: 'active', dayEntries: complete(1, 74), todayDayNumber: 75, jokers: 1 }).status).toBe('active')
    expect(evaluateChallenge({ currentStatus: 'active', dayEntries: complete(1, 75), todayDayNumber: 75, jokers: 1 }).status).toBe('completed')
  })

  it('leaves an archived attempt as it is', () => {
    expect(evaluateChallenge({ currentStatus: 'failed', dayEntries: [], todayDayNumber: 9, jokers: 3 }).status).toBe('failed')
  })
})

import { describe, expect, it } from 'vitest'
import { bookCountsForAttempt, buildBadgeContext, evaluateNewBadges, type BadgeContext } from '../badges'
import type { DayTaskData } from '../types'

function emptyContext(overrides: Partial<BadgeContext> = {}): BadgeContext {
  return {
    streakLength: 0,
    perfectDays: 0,
    workoutsLogged: 0,
    outdoorQualifyingWorkouts: 0,
    waterGoalDays: 0,
    photosTaken: 0,
    booksFinished: 0,
    ...overrides,
  }
}

const emptyDay: DayTaskData = {
  water_ml: 0,
  pages_read: 0,
  dietFollowed: false,
  noAlcohol: false,
  hasPhoto: false,
  workouts: [],
}

const perfectDay: DayTaskData = {
  water_ml: 3800,
  pages_read: 10,
  dietFollowed: true,
  noAlcohol: true,
  hasPhoto: true,
  workouts: [
    { durationMin: 45, isOutdoor: true },
    { durationMin: 60, isOutdoor: false },
  ],
}

describe('evaluateNewBadges', () => {
  it('unlocks nothing when nothing has happened', () => {
    expect(evaluateNewBadges(emptyContext(), new Set())).toEqual([])
  })

  it('unlocks a streak milestone badge once the streak reaches it', () => {
    expect(evaluateNewBadges(emptyContext({ streakLength: 7 }), new Set())).toContain('streak-7')
  })

  it('also unlocks milestones the streak has already passed, so a missed unlock is never lost', () => {
    const result = evaluateNewBadges(emptyContext({ streakLength: 15 }), new Set())
    expect(result).toEqual(expect.arrayContaining(['streak-7', 'streak-14']))
    expect(result).not.toContain('streak-21')
  })

  it('never returns an already-unlocked badge', () => {
    const result = evaluateNewBadges(
      emptyContext({ streakLength: 7, workoutsLogged: 3 }),
      new Set(['streak-7', 'first-workout']),
    )
    expect(result).toEqual([])
  })

  it('unlocks each "first" badge as soon as it has happened once in the attempt', () => {
    expect(evaluateNewBadges(emptyContext({ workoutsLogged: 1 }), new Set())).toEqual(['first-workout'])
    expect(evaluateNewBadges(emptyContext({ outdoorQualifyingWorkouts: 1 }), new Set())).toEqual([
      'first-outdoor-workout',
    ])
    expect(evaluateNewBadges(emptyContext({ perfectDays: 1 }), new Set())).toEqual(['first-perfect-day'])
    expect(evaluateNewBadges(emptyContext({ booksFinished: 1 }), new Set())).toEqual(['first-book-finished'])
    expect(evaluateNewBadges(emptyContext({ waterGoalDays: 1 }), new Set())).toEqual(['first-water-goal'])
    expect(evaluateNewBadges(emptyContext({ photosTaken: 1 }), new Set())).toEqual(['first-photo'])
  })

  it('can unlock several badges at once', () => {
    const result = evaluateNewBadges(emptyContext({ streakLength: 7, perfectDays: 7, photosTaken: 7 }), new Set())
    expect(result).toEqual(expect.arrayContaining(['streak-7', 'first-perfect-day', 'first-photo']))
  })
})

describe('bookCountsForAttempt', () => {
  it('counts a book finished on or after the attempt started', () => {
    expect(bookCountsForAttempt('2026-09-24', '2026-09-24')).toBe(true)
    expect(bookCountsForAttempt('2026-10-02', '2026-09-24')).toBe(true)
  })

  it('does not count a book finished before the attempt (e.g. during an earlier attempt)', () => {
    expect(bookCountsForAttempt('2026-09-23', '2026-09-24')).toBe(false)
  })

  it('does not count a book with no known finish date', () => {
    expect(bookCountsForAttempt(undefined, '2026-09-24')).toBe(false)
  })
})

describe('buildBadgeContext', () => {
  it('is all zeros for an attempt with nothing logged', () => {
    expect(buildBadgeContext({ days: [{ dayNumber: 1, data: emptyDay }], todayDayNumber: 1, booksFinished: 0 })).toEqual(
      emptyContext(),
    )
  })

  it('tallies workouts, outdoor qualifying workouts, water goal days, photos and perfect days', () => {
    const context = buildBadgeContext({
      days: [
        { dayNumber: 1, data: perfectDay },
        {
          dayNumber: 2,
          data: { ...emptyDay, water_ml: 4000, workouts: [{ durationMin: 30, isOutdoor: true }] },
        },
      ],
      todayDayNumber: 2,
      booksFinished: 1,
    })
    expect(context).toEqual({
      streakLength: 1,
      perfectDays: 1,
      workoutsLogged: 3,
      // the 30-minute outdoor walk is too short to qualify
      outdoorQualifyingWorkouts: 1,
      waterGoalDays: 2,
      photosTaken: 1,
      booksFinished: 1,
    })
  })

  it('uses the displayed streak, which counts yesterday while today is in progress', () => {
    const days = Array.from({ length: 7 }, (_, i) => ({ dayNumber: i + 1, data: perfectDay }))
    const context = buildBadgeContext({
      days: [...days, { dayNumber: 8, data: emptyDay }],
      todayDayNumber: 8,
      booksFinished: 0,
    })
    expect(context.streakLength).toBe(7)
  })
})

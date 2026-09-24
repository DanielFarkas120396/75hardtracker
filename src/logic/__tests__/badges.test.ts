import { describe, expect, it } from 'vitest'
import { evaluateNewBadges, type BadgeContext } from '../badges'

function baseContext(overrides: Partial<BadgeContext> = {}): BadgeContext {
  return {
    streakLength: 1,
    isPerfectDay: false,
    todayHasAnyWorkout: false,
    todayHasOutdoorQualifyingWorkout: false,
    workoutsLoggedBeforeToday: 1,
    outdoorQualifyingWorkoutsLoggedBeforeToday: 1,
    todayHitWaterGoal: false,
    waterGoalHitOnAnyPriorDay: true,
    todayHasPhoto: false,
    photosLoggedBeforeToday: 1,
    bookFinishedToday: false,
    booksFinishedBeforeToday: 1,
    ...overrides,
  }
}

describe('evaluateNewBadges', () => {
  it('unlocks nothing when nothing new happened', () => {
    expect(evaluateNewBadges(baseContext(), new Set())).toEqual([])
  })

  it('unlocks a streak milestone badge exactly at the milestone streak length', () => {
    expect(evaluateNewBadges(baseContext({ streakLength: 7 }), new Set())).toContain('streak-7')
  })

  it('does not re-unlock an already-unlocked streak milestone badge', () => {
    const result = evaluateNewBadges(baseContext({ streakLength: 7 }), new Set(['streak-7']))
    expect(result).not.toContain('streak-7')
  })

  it('unlocks first-workout only on the very first workout ever logged', () => {
    const result = evaluateNewBadges(
      baseContext({ workoutsLoggedBeforeToday: 0, todayHasAnyWorkout: true }),
      new Set(),
    )
    expect(result).toContain('first-workout')
  })

  it('does not unlock first-workout if a workout was already logged before today', () => {
    const result = evaluateNewBadges(
      baseContext({ workoutsLoggedBeforeToday: 2, todayHasAnyWorkout: true }),
      new Set(),
    )
    expect(result).not.toContain('first-workout')
  })

  it('unlocks first-outdoor-workout on the first qualifying outdoor workout', () => {
    const result = evaluateNewBadges(
      baseContext({ outdoorQualifyingWorkoutsLoggedBeforeToday: 0, todayHasOutdoorQualifyingWorkout: true }),
      new Set(),
    )
    expect(result).toContain('first-outdoor-workout')
  })

  it('unlocks first-perfect-day when today is a perfect day and it is not yet unlocked', () => {
    const result = evaluateNewBadges(baseContext({ isPerfectDay: true }), new Set())
    expect(result).toContain('first-perfect-day')
  })

  it('unlocks first-book-finished only the first time a book is finished', () => {
    const result = evaluateNewBadges(
      baseContext({ booksFinishedBeforeToday: 0, bookFinishedToday: true }),
      new Set(),
    )
    expect(result).toContain('first-book-finished')
  })

  it('unlocks first-water-goal only the first time the water goal is hit', () => {
    const result = evaluateNewBadges(
      baseContext({ waterGoalHitOnAnyPriorDay: false, todayHitWaterGoal: true }),
      new Set(),
    )
    expect(result).toContain('first-water-goal')
  })

  it('unlocks first-photo only on the first photo ever taken', () => {
    const result = evaluateNewBadges(baseContext({ photosLoggedBeforeToday: 0, todayHasPhoto: true }), new Set())
    expect(result).toContain('first-photo')
  })

  it('can unlock multiple badges in the same day', () => {
    const result = evaluateNewBadges(
      baseContext({
        streakLength: 7,
        isPerfectDay: true,
        photosLoggedBeforeToday: 0,
        todayHasPhoto: true,
      }),
      new Set(),
    )
    expect(result).toEqual(expect.arrayContaining(['streak-7', 'first-perfect-day', 'first-photo']))
  })
})

import { describe, expect, it } from 'vitest'
import { calculateChallengeStats, EMPTY_CHALLENGE_STATS } from '../stats'
import type { DayTaskData } from '../types'

const perfectDay: DayTaskData = {
  water_ml: 3800,
  pages_read: 12,
  dietFollowed: true,
  noAlcohol: true,
  hasPhoto: true,
  workouts: [
    { durationMin: 45, isOutdoor: true },
    { durationMin: 60, isOutdoor: false },
  ],
}

describe('calculateChallengeStats', () => {
  it('is all zeros for an attempt with nothing logged', () => {
    expect(calculateChallengeStats([])).toEqual(EMPTY_CHALLENGE_STATS)
  })

  it('adds up water, pages, workout minutes, perfect days and XP', () => {
    const halfDay: DayTaskData = {
      ...perfectDay,
      pages_read: 4,
      hasPhoto: false,
      workouts: [{ durationMin: 30, isOutdoor: true }],
    }
    expect(
      calculateChallengeStats([
        { dayNumber: 1, data: perfectDay },
        { dayNumber: 2, data: halfDay },
      ]),
    ).toEqual({
      xp: 75 + 20, // a perfect day, then diet and water on Day 2
      perfectDays: 1,
      water_ml: 7600,
      pages: 16,
      workoutMinutes: 135,
    })
  })
})

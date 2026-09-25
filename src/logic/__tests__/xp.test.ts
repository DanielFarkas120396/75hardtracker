import { describe, expect, it } from 'vitest'
import { calculateChallengeXp, calculateDayXp, completedDayXp, streakMilestoneBonus } from '../xp'
import type { DayTaskData } from '../types'

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

const emptyDay: DayTaskData = {
  water_ml: 0,
  pages_read: 0,
  dietFollowed: false,
  noAlcohol: false,
  hasPhoto: false,
  workouts: [],
}

describe('calculateDayXp', () => {
  it('awards 10 XP per completed task, no bonuses, for zero tasks done', () => {
    expect(calculateDayXp(emptyDay, 0)).toEqual({
      taskXp: 0,
      perfectDayBonus: 0,
      streakMilestoneBonus: 0,
      total: 0,
    })
  })

  it('awards partial task XP with no perfect-day bonus', () => {
    const partial: DayTaskData = { ...emptyDay, water_ml: 3800, pages_read: 10 }
    expect(calculateDayXp(partial, 1)).toEqual({
      taskXp: 20,
      perfectDayBonus: 0,
      streakMilestoneBonus: 0,
      total: 20,
    })
  })

  it('awards the perfect-day bonus when all five tasks are complete', () => {
    // streak of 1 is not a milestone, so only task + perfect-day XP applies
    expect(calculateDayXp(perfectDay, 1)).toEqual({
      taskXp: 50,
      perfectDayBonus: 25,
      streakMilestoneBonus: 0,
      total: 75,
    })
  })

  it('adds the streak milestone bonus when the resulting streak hits a milestone', () => {
    expect(calculateDayXp(perfectDay, 7)).toEqual({
      taskXp: 50,
      perfectDayBonus: 25,
      streakMilestoneBonus: 100,
      total: 175,
    })
  })

  it('does not award a streak milestone bonus for a non-milestone streak length', () => {
    expect(calculateDayXp(perfectDay, 8).streakMilestoneBonus).toBe(0)
  })

  it('never awards a milestone bonus to an incomplete day, even if a milestone streak is passed', () => {
    const partial: DayTaskData = { ...perfectDay, hasPhoto: false }
    expect(calculateDayXp(partial, 7)).toEqual({
      taskXp: 40,
      perfectDayBonus: 0,
      streakMilestoneBonus: 0,
      total: 40,
    })
  })
})

describe('streakMilestoneBonus', () => {
  it('pays out exactly at each milestone length', () => {
    for (const milestone of [7, 14, 21, 30, 50, 75]) {
      expect(streakMilestoneBonus(milestone)).toBe(100)
    }
  })

  it('is 0 between milestones', () => {
    expect(streakMilestoneBonus(0)).toBe(0)
    expect(streakMilestoneBonus(6)).toBe(0)
    expect(streakMilestoneBonus(8)).toBe(0)
  })
})

describe('completedDayXp', () => {
  it('is 50 task XP plus the 25 perfect-day bonus on an ordinary day', () => {
    expect(completedDayXp(3)).toBe(75)
  })

  it('adds the milestone bonus when the streak reaches a milestone', () => {
    expect(completedDayXp(75)).toBe(175)
  })

  it('matches calculateDayXp for a perfect day', () => {
    expect(completedDayXp(14)).toBe(calculateDayXp(perfectDay, 14).total)
  })
})

describe('calculateChallengeXp', () => {
  const perfectDays = (dayNumbers: number[]) => dayNumbers.map((dayNumber) => ({ dayNumber, data: perfectDay }))

  it('is 0 for an attempt with nothing logged', () => {
    expect(calculateChallengeXp([])).toBe(0)
  })

  it('adds the milestone bonus when the streak reaches 7 days', () => {
    expect(calculateChallengeXp(perfectDays([1, 2, 3, 4, 5, 6, 7]))).toBe(7 * 75 + 100)
  })

  it('restarts the streak after a day with no entry', () => {
    // Day 7 was never logged, so Day 8 starts a new streak and earns no 7-day bonus.
    expect(calculateChallengeXp(perfectDays([1, 2, 3, 4, 5, 6, 8]))).toBe(7 * 75)
  })

  it('restarts the streak after an incomplete day, which still earns its task XP', () => {
    const waterOnly = { dayNumber: 4, data: { ...emptyDay, water_ml: 3800 } }
    expect(calculateChallengeXp([...perfectDays([1, 2, 3]), waterOnly, ...perfectDays([5, 6, 7, 8, 9, 10])])).toBe(
      9 * 75 + 10,
    )
  })

  it('does not depend on the order of the days', () => {
    expect(calculateChallengeXp(perfectDays([7, 3, 1, 5, 2, 6, 4]))).toBe(7 * 75 + 100)
  })
})

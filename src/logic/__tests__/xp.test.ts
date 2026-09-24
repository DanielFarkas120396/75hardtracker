import { describe, expect, it } from 'vitest'
import { calculateDayXp } from '../xp'
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
})

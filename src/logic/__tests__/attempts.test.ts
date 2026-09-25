import { describe, expect, it } from 'vitest'
import { attemptDayRows, summarizeAttempt } from '../attempts'
import { TASK_IDS } from '../dayCompletion'
import type { ChallengeDayData, DayTaskData } from '../types'

const perfect: DayTaskData = {
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

const waterAndReadingOnly: DayTaskData = {
  water_ml: 3800,
  pages_read: 10,
  dietFollowed: false,
  noAlcohol: false,
  hasPhoto: false,
  workouts: [],
}

const perfectDays = (from: number, to: number): ChallengeDayData[] =>
  Array.from({ length: to - from + 1 }, (_, i) => ({ dayNumber: from + i, data: perfect }))

describe('summarizeAttempt', () => {
  it('reports the day a failed attempt broke on, with its date', () => {
    const days = [...perfectDays(1, 11), { dayNumber: 12, data: waterAndReadingOnly }]
    expect(summarizeAttempt({ startDate: '2026-09-01', status: 'failed', days, todayDayNumber: 14 })).toEqual({
      reachedDay: 12,
      completedDays: 11,
      startDate: '2026-09-01',
      endDate: '2026-09-12',
      // 11 perfect days at 75 XP, the 7-day streak bonus, and two tasks on Day 12.
      xp: 11 * 75 + 100 + 20,
    })
  })

  it('counts a day that was never opened as the day it failed', () => {
    const summary = summarizeAttempt({
      startDate: '2026-09-01',
      status: 'failed',
      days: perfectDays(1, 3),
      todayDayNumber: 6,
    })
    expect(summary).toMatchObject({ reachedDay: 4, completedDays: 3, endDate: '2026-09-04' })
  })

  it('reaches Day 75 once completed, ending on the final day', () => {
    const summary = summarizeAttempt({
      startDate: '2026-01-01',
      status: 'completed',
      days: perfectDays(1, 75),
      todayDayNumber: 80,
    })
    // 75 perfect days plus the 7/14/21/30/50/75 streak bonuses.
    expect(summary).toMatchObject({ reachedDay: 75, completedDays: 75, endDate: '2026-03-16', xp: 75 * 75 + 600 })
  })

  it('is still running while active: today is the day reached and there is no end date', () => {
    const summary = summarizeAttempt({
      startDate: '2026-09-20',
      status: 'active',
      days: perfectDays(1, 4),
      todayDayNumber: 5,
    })
    expect(summary).toMatchObject({ reachedDay: 5, completedDays: 4, endDate: undefined })
  })

  it('has reached no day yet before the start', () => {
    const summary = summarizeAttempt({ startDate: '2026-10-01', status: 'active', days: [], todayDayNumber: -2 })
    expect(summary).toEqual({ reachedDay: 0, completedDays: 0, startDate: '2026-10-01', endDate: undefined, xp: 0 })
  })
})

describe('attemptDayRows', () => {
  it('groups the complete days and lists what each other day missed', () => {
    const days = [...perfectDays(1, 3), { dayNumber: 4, data: waterAndReadingOnly }]
    expect(attemptDayRows(days, 5)).toEqual([
      { kind: 'complete', fromDay: 1, toDay: 3 },
      { kind: 'incomplete', dayNumber: 4, missing: ['workouts', 'diet', 'photo'] },
      { kind: 'incomplete', dayNumber: 5, missing: [...TASK_IDS] },
    ])
  })

  it('starts a new run of complete days after a missed one', () => {
    expect(attemptDayRows([...perfectDays(1, 2), ...perfectDays(4, 5)], 5)).toEqual([
      { kind: 'complete', fromDay: 1, toDay: 2 },
      { kind: 'incomplete', dayNumber: 3, missing: [...TASK_IDS] },
      { kind: 'complete', fromDay: 4, toDay: 5 },
    ])
  })

  it('stops at the day reached, and is empty before Day 1', () => {
    expect(attemptDayRows(perfectDays(1, 10), 4)).toEqual([{ kind: 'complete', fromDay: 1, toDay: 4 }])
    expect(attemptDayRows([], 0)).toEqual([])
  })
})

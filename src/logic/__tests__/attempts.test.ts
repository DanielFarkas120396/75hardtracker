import { describe, expect, it } from 'vitest'
import { attemptDayRows, givenUpDay, summarizeAttempt } from '../attempts'
import { TASK_IDS } from '../dayCompletion'
import { RULESETS } from '../rulesets'
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
    expect(
      summarizeAttempt({ startDate: '2026-09-01', status: 'failed', days, todayDayNumber: 14, rules: RULESETS.hard }),
    ).toEqual({
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
      rules: RULESETS.hard,
    })
    expect(summary).toMatchObject({ reachedDay: 4, completedDays: 3, endDate: '2026-09-04' })
  })

  it('reaches Day 75 once completed, ending on the final day', () => {
    const summary = summarizeAttempt({
      startDate: '2026-01-01',
      status: 'completed',
      days: perfectDays(1, 75),
      todayDayNumber: 80,
      rules: RULESETS.hard,
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
      rules: RULESETS.hard,
    })
    expect(summary).toMatchObject({ reachedDay: 5, completedDays: 4, endDate: undefined })
  })

  it('has reached no day yet before the start', () => {
    const summary = summarizeAttempt({
      startDate: '2026-10-01',
      status: 'active',
      days: [],
      todayDayNumber: -2,
      rules: RULESETS.hard,
    })
    expect(summary).toEqual({ reachedDay: 0, completedDays: 0, startDate: '2026-10-01', endDate: undefined, xp: 0 })
  })

  it('reaches the day the jokers ran out on: a failed Medium attempt that missed Days 3 and 6 reached Day 6, Hard reached Day 3', () => {
    const days = [...perfectDays(1, 2), ...perfectDays(4, 5)] // Days 3 and 6 are missing entirely
    const params = { startDate: '2026-09-01', status: 'failed' as const, days, todayDayNumber: 8 }
    expect(summarizeAttempt({ ...params, rules: RULESETS.medium }).reachedDay).toBe(6)
    expect(summarizeAttempt({ ...params, rules: RULESETS.hard }).reachedDay).toBe(3)
  })

  it('reaches the day a given-up attempt ended on, and ends that day', () => {
    // Day 6 is missing (a joker), so the failed fallback (missed[jokers] with
    // 3 jokers) would land on missed[3]: [6, 12, 13, 14, …][3] = Day 14. Only
    // the abandoned branch reaches Day 12, the actual give-up day.
    const summary = summarizeAttempt({
      startDate: '2026-09-01',
      status: 'abandoned',
      abandonedOn: '2026-09-12',
      days: [...perfectDays(1, 5), ...perfectDays(7, 11)],
      todayDayNumber: 20,
      rules: RULESETS.soft,
    })
    expect(summary).toMatchObject({ reachedDay: 12, completedDays: 10, endDate: '2026-09-12' })
  })

  it('falls back to the last logged day when a given-up attempt has no give-up date', () => {
    // Day 5 was never opened and Day 6 is only partly logged (incomplete), so
    // the failed fallback (missed[0], no jokers under Hard) would land on the
    // first miss, Day 5. Only the abandoned branch reaches Day 6, the last day
    // with an entry at all.
    const summary = summarizeAttempt({
      startDate: '2026-09-01',
      status: 'abandoned',
      days: [...perfectDays(1, 4), { dayNumber: 6, data: waterAndReadingOnly }],
      todayDayNumber: 20,
      rules: RULESETS.hard,
    })
    expect(summary).toMatchObject({ reachedDay: 6, completedDays: 4, endDate: '2026-09-06' })
  })
})

describe('givenUpDay', () => {
  it('turns the give-up date into its day number', () => {
    expect(givenUpDay('2026-09-01', '2026-09-12')).toBe(12)
  })

  it('is undefined without a date, with a broken one, or outside Days 1–75', () => {
    expect(givenUpDay('2026-09-01', undefined)).toBeUndefined()
    expect(givenUpDay('2026-09-01', 'not-a-date')).toBeUndefined()
    expect(givenUpDay('2026-09-01', '2026-08-31')).toBeUndefined()
    expect(givenUpDay('2026-09-01', '2026-11-15')).toBeUndefined() // Day 76
  })
})

describe('attemptDayRows', () => {
  it('groups the complete days and lists what each other day missed', () => {
    const days = [...perfectDays(1, 3), { dayNumber: 4, data: waterAndReadingOnly }]
    expect(attemptDayRows(days, 5, RULESETS.hard)).toEqual([
      { kind: 'complete', fromDay: 1, toDay: 3 },
      { kind: 'incomplete', dayNumber: 4, missing: ['workouts', 'diet', 'photo'] },
      { kind: 'incomplete', dayNumber: 5, missing: [...TASK_IDS] },
    ])
  })

  it('starts a new run of complete days after a missed one', () => {
    expect(attemptDayRows([...perfectDays(1, 2), ...perfectDays(4, 5)], 5, RULESETS.hard)).toEqual([
      { kind: 'complete', fromDay: 1, toDay: 2 },
      { kind: 'incomplete', dayNumber: 3, missing: [...TASK_IDS] },
      { kind: 'complete', fromDay: 4, toDay: 5 },
    ])
  })

  it('stops at the day reached, and is empty before Day 1', () => {
    expect(attemptDayRows(perfectDays(1, 10), 4, RULESETS.hard)).toEqual([{ kind: 'complete', fromDay: 1, toDay: 4 }])
    expect(attemptDayRows([], 0, RULESETS.hard)).toEqual([])
  })
})

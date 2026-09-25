import { describe, expect, it } from 'vitest'
import { MIN_WORKOUT_MIN, PAGES_TARGET, WATER_TARGET_ML } from '../constants'
import {
  bedtimeMinutes,
  formatHHmm,
  isValidBedtime,
  menace,
  minutesToFinish,
  parseHHmm,
  planError,
  plansToMinutes,
  type Menace,
  type MenaceLevel,
  type MenaceReason,
} from '../menace'
import type { DayTaskData, TaskId } from '../types'

const DONE: DayTaskData = {
  water_ml: WATER_TARGET_ML,
  pages_read: PAGES_TARGET,
  dietFollowed: true,
  noAlcohol: true,
  hasPhoto: true,
  workouts: [
    { durationMin: MIN_WORKOUT_MIN, isOutdoor: true },
    { durationMin: MIN_WORKOUT_MIN, isOutdoor: false },
  ],
}
const NOTHING: DayTaskData = { water_ml: 0, pages_read: 0, dietFollowed: false, noAlcohol: false, hasPhoto: false, workouts: [] }
const ONE_WORKOUT_LEFT: DayTaskData = { ...DONE, workouts: [{ durationMin: MIN_WORKOUT_MIN, isOutdoor: true }] }
const ONLY_READING: DayTaskData = { ...DONE, pages_read: 0 }
/** 1.7 L of water, reading, photo and diet left: 102 + 20 + 2 + 2 = 126 minutes. */
const EVENING_MIX: DayTaskData = { ...DONE, water_ml: 2100, pages_read: 0, hasPhoto: false, dietFollowed: false }

type Options = { plans?: Partial<Record<TaskId, string>>; bedtime?: string }

const min = (time: string) => parseHHmm(time)!

function at(time: string, data: DayTaskData, options: Options = {}): Menace {
  return menace({
    data,
    nowMin: min(time),
    bedtimeMin: min(options.bedtime ?? '23:00'),
    plans: plansToMinutes(options.plans),
  })
}

// The spec's reference cases (section 2), bedtime 23:00 unless noted.
const CASES: [number, string, DayTaskData, Options, MenaceLevel, MenaceReason][] = [
  [1, '10:00', NOTHING, {}, 'watching', 'plenty'],
  [2, '19:30', EVENING_MIX, {}, 'watching', 'plenty'],
  [3, '20:00', EVENING_MIX, {}, 'tapping', 'close'],
  [4, '21:00', ONE_WORKOUT_LEFT, {}, 'watching', 'plenty'],
  [5, '21:15', ONE_WORKOUT_LEFT, {}, 'tapping', 'close'],
  [6, '22:15', ONE_WORKOUT_LEFT, {}, 'hunting', 'wont-fit'],
  [7, '22:25', ONLY_READING, {}, 'watching', 'plenty'],
  [8, '22:30', ONLY_READING, {}, 'tapping', 'close'],
  [9, '22:40', ONLY_READING, {}, 'hunting', 'wont-fit'],
  [10, '22:35', ONLY_READING, { plans: { reading: '22:30' } }, 'watching', 'plan-due'],
  [11, '23:05', ONLY_READING, { plans: { reading: '22:30' } }, 'hunting', 'past-bedtime'],
  [12, '20:50', ONE_WORKOUT_LEFT, { plans: { workouts: '20:00' } }, 'watching', 'plan-due'],
  [13, '21:00', ONE_WORKOUT_LEFT, { plans: { workouts: '20:00' } }, 'tapping', 'plan-broken'],
  [14, '15:00', { ...DONE, dietFollowed: false }, {}, 'watching', 'plenty'],
  [15, '12:00', DONE, {}, 'content', 'done'],
  [16, '23:30', { ...DONE, hasPhoto: false }, { bedtime: '23:59' }, 'tapping', 'close'],
]

describe('menace: the reference cases', () => {
  it.each(CASES)('case %i at %s', (_case, time, data, options, level, reason) => {
    const result = at(time, data, options)
    expect([result.level, result.reason]).toEqual([level, reason])
  })
})

describe('menace: plans', () => {
  it('points at the earliest plan still covering a task', () => {
    const result = at('19:00', { ...DONE, pages_read: 0, hasPhoto: false }, { plans: { reading: '22:30', photo: '21:00' } })
    expect(result).toMatchObject({ level: 'watching', reason: 'plan-pending', next: { task: 'photo', at: min('21:00') } })
  })

  it('ignores plans for tasks already done', () => {
    expect(at('23:30', DONE, { plans: { reading: '20:00' } })).toEqual({ level: 'content', reason: 'done' })
  })

  it('reports the plan that was broken', () => {
    expect(at('21:00', ONE_WORKOUT_LEFT, { plans: { workouts: '20:00' } }).broken).toEqual({
      task: 'workouts',
      at: min('20:00'),
    })
  })
})

describe('minutesToFinish', () => {
  it('estimates each task from where the day stands', () => {
    expect(minutesToFinish('water', { ...NOTHING, water_ml: 2100 })).toBe(102)
    expect(minutesToFinish('reading', { ...NOTHING, pages_read: 4 })).toBe(12)
    expect(minutesToFinish('workouts', NOTHING)).toBe(90)
    expect(minutesToFinish('photo', NOTHING)).toBe(2)
    expect(minutesToFinish('diet', NOTHING)).toBe(2)
  })

  it('needs one more workout when neither of two is outdoors', () => {
    const indoors: DayTaskData = {
      ...NOTHING,
      workouts: [
        { durationMin: 45, isOutdoor: false },
        { durationMin: 60, isOutdoor: false },
      ],
    }
    expect(minutesToFinish('workouts', indoors)).toBe(45)
  })
})

describe('planError', () => {
  it('refuses a time that has passed', () => {
    expect(planError('reading', '19:59', ONLY_READING, min('20:00'))).toBe('past')
  })

  it('refuses a task that would run past midnight', () => {
    expect(planError('reading', '23:50', ONLY_READING, min('20:00'))).toBe('past-midnight')
  })

  it('accepts a time that fits, and treats a blank time as no plan', () => {
    expect(planError('reading', '23:40', ONLY_READING, min('20:00'))).toBeNull()
    expect(planError('reading', '', ONLY_READING, min('20:00'))).toBeNull()
  })
})

describe('time helpers', () => {
  it('parses and formats 24-hour times', () => {
    expect(parseHHmm('07:05')).toBe(425)
    expect(parseHHmm('24:00')).toBeNull()
    expect(parseHHmm('7:05')).toBeNull()
    expect(formatHHmm(425)).toBe('07:05')
  })

  it('keeps the bedtime between 18:00 and 23:59, defaulting to 23:00', () => {
    expect(isValidBedtime('22:30')).toBe(true)
    expect(isValidBedtime('17:59')).toBe(false)
    expect(bedtimeMinutes('22:30')).toBe(min('22:30'))
    expect(bedtimeMinutes('03:00')).toBe(min('23:00'))
    expect(bedtimeMinutes(undefined)).toBe(min('23:00'))
  })

  it('reads a saved plan, skipping malformed times', () => {
    expect(plansToMinutes({ reading: '22:30', photo: 'soon' })).toEqual({ reading: min('22:30') })
    expect(plansToMinutes(undefined)).toEqual({})
  })
})

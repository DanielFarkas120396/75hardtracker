import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  addDaysISO,
  dateForDayNumber,
  dayNumberForDate,
  formatDisplayDate,
  isValidISODate,
  msUntilNextLocalMidnight,
  todayISO,
} from '../dates'

// West of UTC, `new Date('yyyy-MM-dd')` (UTC midnight) lands on the previous
// local day, so this zone exposes any date parsed as UTC. It also has a DST
// switch on 2026-03-08.
const TEST_TZ = 'America/Los_Angeles'
const HOUR = 60 * 60 * 1000

// Node re-reads process.env.TZ whenever it's assigned, which vi.stubEnv does.
beforeAll(() => {
  vi.stubEnv('TZ', TEST_TZ)
})

afterAll(() => {
  vi.unstubAllEnvs()
})

describe(`dates (TZ=${TEST_TZ})`, () => {
  it('runs in the intended time zone', () => {
    expect(new Date(2026, 0, 15).getTimezoneOffset()).toBe(480)
  })

  it('formats today in local time, not UTC', () => {
    // 23:30 local on the 24th is already the 25th in UTC.
    expect(todayISO(new Date(2026, 8, 24, 23, 30))).toBe('2026-09-24')
  })

  it('treats yyyy-MM-dd strings as local calendar dates', () => {
    expect(formatDisplayDate('2026-09-24')).toBe('24 Sep 2026')
    expect(addDaysISO('2026-09-24', 1)).toBe('2026-09-25')
    expect(addDaysISO('2026-09-24', -1)).toBe('2026-09-23')
  })

  it('numbers days from the start date, starting at 1', () => {
    expect(dayNumberForDate('2026-09-24', '2026-09-24')).toBe(1)
    expect(dayNumberForDate('2026-09-24', '2026-09-25')).toBe(2)
    expect(dayNumberForDate('2026-09-24', '2026-12-07')).toBe(75)
  })

  it('gives day 0 and negative numbers before the start date', () => {
    expect(dayNumberForDate('2026-09-24', '2026-09-23')).toBe(0)
    expect(dayNumberForDate('2026-09-24', '2026-09-20')).toBe(-3)
  })

  it('counts calendar days across a DST change', () => {
    expect(dayNumberForDate('2026-03-07', '2026-03-09')).toBe(3)
    expect(dateForDayNumber('2026-03-07', 3)).toBe('2026-03-09')
    expect(dayNumberForDate('2026-10-31', '2026-11-02')).toBe(3)
  })

  it('returns NaN instead of garbage for an invalid date', () => {
    expect(dayNumberForDate('', '2026-09-24')).toBeNaN()
    expect(dayNumberForDate('2026-09-24', 'not a date')).toBeNaN()
  })

  it('validates ISO dates', () => {
    expect(isValidISODate('2026-09-24')).toBe(true)
    expect(isValidISODate('2028-02-29')).toBe(true)
    expect(isValidISODate('')).toBe(false)
    expect(isValidISODate('2026-02-30')).toBe(false)
    expect(isValidISODate('2026-9-4')).toBe(false)
    expect(isValidISODate('2026-09-24T10:00')).toBe(false)
  })

  it('measures time until the next local midnight', () => {
    expect(msUntilNextLocalMidnight(new Date(2026, 8, 24, 23, 0))).toBe(1 * HOUR)
    expect(msUntilNextLocalMidnight(new Date(2026, 8, 24, 12, 0))).toBe(12 * HOUR)
  })

  it('accounts for the short day when clocks spring forward', () => {
    expect(msUntilNextLocalMidnight(new Date(2026, 2, 8, 0, 0))).toBe(23 * HOUR)
  })
})

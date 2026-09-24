import { describe, expect, it } from 'vitest'
import { isStartDateEditable, validateStartDateChange } from '../startDate'

const today = '2026-09-24'

describe('isStartDateEditable', () => {
  it('is editable before the challenge starts and on Day 1', () => {
    expect(isStartDateEditable(-5)).toBe(true)
    expect(isStartDateEditable(0)).toBe(true)
    expect(isStartDateEditable(1)).toBe(true)
  })

  it('locks from Day 2 on', () => {
    expect(isStartDateEditable(2)).toBe(false)
    expect(isStartDateEditable(75)).toBe(false)
  })

  it('stays editable when the stored start date is broken (NaN day number)', () => {
    expect(isStartDateEditable(Number.NaN)).toBe(true)
  })
})

describe('validateStartDateChange', () => {
  it('accepts today', () => {
    expect(validateStartDateChange({ proposed: today, today, todayDayNumber: 1 })).toEqual({ ok: true })
  })

  it('accepts a future date', () => {
    expect(validateStartDateChange({ proposed: '2026-10-05', today, todayDayNumber: 1 })).toEqual({ ok: true })
  })

  it('rejects a past date (no backfilling)', () => {
    expect(validateStartDateChange({ proposed: '2026-09-23', today, todayDayNumber: 1 })).toEqual({
      ok: false,
      reason: 'past',
    })
  })

  it('rejects an empty value, e.g. a cleared date field', () => {
    expect(validateStartDateChange({ proposed: '', today, todayDayNumber: 1 })).toEqual({
      ok: false,
      reason: 'empty',
    })
  })

  it('rejects malformed and impossible dates', () => {
    expect(validateStartDateChange({ proposed: '2026-02-30', today: '2026-01-01', todayDayNumber: 1 })).toEqual({
      ok: false,
      reason: 'invalid',
    })
    expect(validateStartDateChange({ proposed: '24/09/2026', today, todayDayNumber: 1 })).toEqual({
      ok: false,
      reason: 'invalid',
    })
  })

  it('rejects any change once the attempt is past Day 1', () => {
    expect(validateStartDateChange({ proposed: '2026-10-05', today, todayDayNumber: 2 })).toEqual({
      ok: false,
      reason: 'locked',
    })
  })

  it('allows repairing a broken start date', () => {
    expect(validateStartDateChange({ proposed: today, today, todayDayNumber: Number.NaN })).toEqual({ ok: true })
  })
})

import { describe, expect, it } from 'vitest'
import { parseDecimal, validateMeasurement, weightSummary } from '../measurements'

const today = '2026-09-24'

describe('parseDecimal', () => {
  it('accepts a dot or a comma as the decimal separator', () => {
    expect(parseDecimal('82.5')).toBe(82.5)
    expect(parseDecimal('82,5')).toBe(82.5)
    expect(parseDecimal(' 90 ')).toBe(90)
  })

  it('is undefined for empty input and NaN for anything else', () => {
    expect(parseDecimal('')).toBeUndefined()
    expect(parseDecimal('   ')).toBeUndefined()
    expect(parseDecimal('abc')).toBeNaN()
    expect(parseDecimal('-5')).toBeNaN()
    expect(parseDecimal('8,2,5')).toBeNaN()
  })
})

describe('validateMeasurement', () => {
  it('accepts a weight with optional body measurements, rounded to 0.1', () => {
    expect(
      validateMeasurement({ date: today, weight: '82,46', body: { waist: '88', arms: '35.25' } }, today),
    ).toEqual({
      ok: true,
      value: { date: today, weight_kg: 82.5, bodyMeasurements_cm: { waist: 88, arms: 35.3 } },
    })
  })

  it('leaves out body measurements that were not filled in', () => {
    expect(validateMeasurement({ date: today, weight: '80', body: { chest: '' } }, today)).toEqual({
      ok: true,
      value: { date: today, weight_kg: 80 },
    })
  })

  it('requires a weight', () => {
    const result = validateMeasurement({ date: today, weight: '', body: { waist: '88' } }, today)
    expect(result).toEqual({ ok: false, errors: { weight: 'Enter your weight.' } })
  })

  it('rejects implausible values and text', () => {
    const result = validateMeasurement({ date: today, weight: '8', body: { waist: 'big', hips: '400' } }, today)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(['hips', 'waist', 'weight'])
  })

  it('rejects a future or missing date', () => {
    expect(validateMeasurement({ date: '2026-09-25', weight: '80', body: {} }, today)).toMatchObject({
      ok: false,
      errors: { date: "That's in the future." },
    })
    expect(validateMeasurement({ date: '', weight: '80', body: {} }, today)).toMatchObject({
      ok: false,
      errors: { date: 'Pick a date.' },
    })
  })
})

describe('weightSummary', () => {
  it('is undefined with no weigh-ins', () => {
    expect(weightSummary([])).toBeUndefined()
  })

  it('has no change with a single weigh-in', () => {
    expect(weightSummary([{ date: today, weight_kg: 82 }])).toEqual({ latest: { date: today, weight_kg: 82 } })
  })

  it('reports the latest weight and the change since the first, whatever the input order', () => {
    expect(
      weightSummary([
        { date: '2026-09-24', weight_kg: 80.1 },
        { date: '2026-09-01', weight_kg: 83.4 },
        { date: '2026-09-12', weight_kg: 81.9 },
      ]),
    ).toEqual({ latest: { date: '2026-09-24', weight_kg: 80.1 }, changeKg: -3.3, since: '2026-09-01' })
  })
})

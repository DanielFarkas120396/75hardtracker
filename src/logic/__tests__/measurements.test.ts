import { describe, expect, it } from 'vitest'
import {
  attemptWeights,
  parseDecimal,
  startingWeight,
  validateMeasurement,
  weightSummary,
  weightTrend,
  type AttemptWeight,
} from '../measurements'

const today = '2026-09-24'

/** Day 1 of the attempt in the tests below: Thursday 1 October 2026. */
const startDate = '2026-10-01'
const weighIn = (date: string, weight_kg = 85) => ({ date, weight_kg })
/** Weigh-ins on the given challenge days, as attemptWeights places them. */
const onDays = (...days: [day: number, weight_kg: number][]): AttemptWeight[] =>
  days.map(([day, weight_kg]) => ({ date: `day-${day}`, weight_kg, day }))

describe('startingWeight', () => {
  it('counts a weigh-in from the evening before Day 1', () => {
    expect(startingWeight([weighIn('2026-10-05'), weighIn('2026-09-30', 88.4)], startDate)).toEqual(
      weighIn('2026-09-30', 88.4),
    )
  })

  it('takes the last one from Day 1 or the week before it', () => {
    const points = [weighIn('2026-09-25', 89), weighIn('2026-10-01', 88), weighIn('2026-09-30', 88.4), weighIn('2026-10-02')]
    expect(startingWeight(points, startDate)).toEqual(weighIn('2026-10-01', 88))
  })

  it('leaves out a weigh-in from 8 days before, and starts from the first one after Day 1', () => {
    expect(startingWeight([weighIn('2026-10-07', 86), weighIn('2026-09-23', 90), weighIn('2026-10-05', 87)], startDate)).toEqual(
      weighIn('2026-10-05', 87),
    )
  })

  it('starts from the first weigh-in after Day 1 when there are only later ones', () => {
    expect(startingWeight([weighIn('2026-10-09', 86), weighIn('2026-10-03', 87)], startDate)).toEqual(weighIn('2026-10-03', 87))
  })

  it('is undefined with no weigh-in on, just before or after Day 1', () => {
    expect(startingWeight([], startDate)).toBeUndefined()
    expect(startingWeight([weighIn('2026-06-12', 92)], startDate)).toBeUndefined()
  })
})

describe('attemptWeights', () => {
  it('numbers each weigh-in by its challenge day, with 0 for a starting one from before Day 1', () => {
    const points = [weighIn('2026-10-10', 86), weighIn('2026-09-30', 88.4), weighIn('2026-10-02', 88)]
    expect(attemptWeights(points, startDate, 75)).toEqual([
      { date: '2026-09-30', weight_kg: 88.4, day: 0 },
      { date: '2026-10-02', weight_kg: 88, day: 2 },
      { date: '2026-10-10', weight_kg: 86, day: 10 },
    ])
    expect(attemptWeights([weighIn('2026-10-01', 88), weighIn('2026-10-03', 87)], startDate, 75).map((p) => p.day)).toEqual([1, 3])
  })

  it('leaves out weigh-ins from before the starting one and after the last day', () => {
    const points = [
      weighIn('2026-06-12', 92),
      weighIn('2026-09-24', 89),
      weighIn('2026-09-28', 88.6),
      weighIn('2026-10-05', 87),
      weighIn('2026-10-06', 86.8),
      weighIn('2026-10-07', 86.5),
    ]
    expect(attemptWeights(points, startDate, 6).map((p) => p.day)).toEqual([0, 5, 6])
  })

  it('keeps the rows it is given, so the list can edit them', () => {
    const rows = [{ id: 7, date: '2026-10-02', weight_kg: 87.9, bodyMeasurements_cm: { waist: 90 } }]
    expect(attemptWeights(rows, startDate, 75)).toEqual([{ ...rows[0], day: 2 }])
  })

  it('is empty without a starting weigh-in', () => {
    expect(attemptWeights([weighIn('2026-06-12', 92)], startDate, 75)).toEqual([])
  })
})

describe('weightTrend', () => {
  it('starts the 7-day average on Day 7, over that day and the 6 before it', () => {
    const trend = weightTrend(onDays([1, 88], [2, 86], [3, 89], [4, 85], [5, 88], [6, 86], [7, 87], [8, 81]))
    expect(trend.slice(0, 6).map((p) => p.average)).toEqual([undefined, undefined, undefined, undefined, undefined, undefined])
    expect(trend[6].average).toBe(87)
    expect(trend[7].average).toBe(86)
  })

  it('leaves the starting weigh-in from before Day 1 out of every average', () => {
    const trend = weightTrend(onDays([0, 100], [1, 80], [2, 80], [3, 80], [4, 80], [5, 80], [6, 80], [7, 80]))
    expect(trend[7].average).toBe(80)
  })

  it('needs 4 weigh-ins in those 7 days', () => {
    const trend = weightTrend(onDays([7, 88], [9, 87], [11, 86], [13, 85]))
    expect(trend.map((p) => p.average)).toEqual([undefined, undefined, undefined, 86.5])
  })

  it('breaks across a gap, and comes back once the week fills up again', () => {
    const daily = Array.from({ length: 7 }, (_, i): [number, number] => [i + 1, 88])
    const trend = weightTrend(onDays(...daily, [15, 86], [16, 86], [17, 86], [18, 86]))
    expect(trend.map((p) => [p.day, p.average])).toEqual([
      [1, undefined],
      [2, undefined],
      [3, undefined],
      [4, undefined],
      [5, undefined],
      [6, undefined],
      [7, 88],
      [15, undefined],
      [16, undefined],
      [17, undefined],
      [18, 86],
    ])
  })
})

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

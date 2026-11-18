import { addDaysISO, dayNumberForDate, isValidISODate } from '../lib/dates'

/** Optional body measurements, in cm, logged alongside the weight. */
export const BODY_MEASUREMENTS = ['waist', 'chest', 'hips', 'arms'] as const
export type BodyMeasurement = (typeof BODY_MEASUREMENTS)[number]

export const WEIGHT_RANGE_KG = { min: 20, max: 300 } as const
export const BODY_RANGE_CM = { min: 20, max: 250 } as const

/**
 * Parses a number the way people type it on a phone: "82,5" and "82.5"
 * both work. Empty input is `undefined`; anything else unparseable is NaN.
 */
export function parseDecimal(input: string): number | undefined {
  const trimmed = input.trim().replace(',', '.')
  if (trimmed === '') return undefined
  return /^\d+(\.\d+)?$/.test(trimmed) ? Number(trimmed) : Number.NaN
}

export interface MeasurementInput {
  date: string
  weight: string
  body: Partial<Record<BodyMeasurement, string>>
}

export interface ValidMeasurement {
  date: string
  weight_kg: number
  bodyMeasurements_cm?: Partial<Record<BodyMeasurement, number>>
}

export type MeasurementErrors = Partial<Record<'date' | 'weight' | BodyMeasurement, string>>

const roundToTenth = (value: number) => Math.round(value * 10) / 10

/**
 * Validates a weigh-in: a date that isn't in the future, a weight in kg
 * (required), and any of waist/chest/hips/arms in cm (optional). Values are
 * rounded to 0.1.
 */
export function validateMeasurement(
  input: MeasurementInput,
  today: string,
): { ok: true; value: ValidMeasurement } | { ok: false; errors: MeasurementErrors } {
  const errors: MeasurementErrors = {}

  if (!isValidISODate(input.date)) errors.date = 'Pick a date.'
  else if (input.date > today) errors.date = "That's in the future."

  const weight = parseDecimal(input.weight)
  if (weight === undefined) errors.weight = 'Enter your weight.'
  else if (Number.isNaN(weight)) errors.weight = 'Enter a number, like 82.5.'
  else if (weight < WEIGHT_RANGE_KG.min || weight > WEIGHT_RANGE_KG.max) {
    errors.weight = `Between ${WEIGHT_RANGE_KG.min} and ${WEIGHT_RANGE_KG.max} kg.`
  }

  const body: Partial<Record<BodyMeasurement, number>> = {}
  for (const key of BODY_MEASUREMENTS) {
    const value = parseDecimal(input.body[key] ?? '')
    if (value === undefined) continue
    if (Number.isNaN(value)) errors[key] = 'Enter a number.'
    else if (value < BODY_RANGE_CM.min || value > BODY_RANGE_CM.max) {
      errors[key] = `Between ${BODY_RANGE_CM.min} and ${BODY_RANGE_CM.max} cm.`
    } else body[key] = roundToTenth(value)
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return {
    ok: true,
    value: {
      date: input.date,
      weight_kg: roundToTenth(weight!),
      ...(Object.keys(body).length > 0 ? { bodyMeasurements_cm: body } : {}),
    },
  }
}

export interface WeightPoint {
  date: string
  weight_kg: number
}

/** A weigh-in placed in the attempt. `day`: 1..75, or 0 for a starting weigh-in from before Day 1 (the "Start" tick). */
export type AttemptWeight<T extends WeightPoint = WeightPoint> = T & { day: number }

/** An attempt weigh-in with the smoothed trend at that day. */
export type TrendWeight = AttemptWeight & { trend: number }

const START_WINDOW_DAYS = 7
/** How much of the trend a day keeps: a weigh-in pulls the line 15% of the way to it per day since the last one. */
const TREND_KEEP_PER_DAY = 0.85

const byDate = (a: WeightPoint, b: WeightPoint) => a.date.localeCompare(b.date)

/**
 * The weigh-in the attempt counts from: the last one dated Day 1 or in the
 * 7 days before it (so the evening before counts), or else the first one after
 * Day 1. The window keeps a weigh-in from an earlier attempt out.
 */
export function startingWeight<T extends WeightPoint>(points: T[], startDate: string): T | undefined {
  const windowStart = addDaysISO(startDate, -START_WINDOW_DAYS)
  const sorted = [...points].sort(byDate)
  return sorted.findLast((p) => p.date >= windowStart && p.date <= startDate) ?? sorted.find((p) => p.date > startDate)
}

/** The attempt's weigh-ins in date order: the starting one, then every later one up to `lastDay`, each with its day number. */
export function attemptWeights<T extends WeightPoint>(points: T[], startDate: string, lastDay: number): AttemptWeight<T>[] {
  const start = startingWeight(points, startDate)
  if (!start) return []
  return [...points]
    .sort(byDate)
    .filter((p) => p.date >= start.date)
    .map((p) => ({ ...p, day: Math.max(0, dayNumberForDate(startDate, p.date)) }))
    .filter((p) => p.day <= lastDay)
}

/**
 * Adds the smoothed trend: it starts at the first weigh-in, and each later one pulls it toward
 * itself by 15% per day since the one before (after a 3-day gap, 39%). It never breaks across
 * a gap, and it evens out the day-to-day ups and downs of water and food.
 */
export function weightTrend(points: AttemptWeight[]): TrendWeight[] {
  let trend = points[0]?.weight_kg ?? 0
  return points.map((point, i) => {
    if (i > 0) trend += (1 - TREND_KEEP_PER_DAY ** (point.day - points[i - 1].day)) * (point.weight_kg - trend)
    return { ...point, trend }
  })
}

/** The latest weight and the change from the starting weight, the first of `attemptWeights` (no change until there are two). */
export function weightSummary(points: AttemptWeight[]): { latest: AttemptWeight; start: AttemptWeight; changeKg?: number } | undefined {
  if (points.length === 0) return undefined
  const start = points[0]
  const latest = points[points.length - 1]
  if (points.length === 1) return { latest, start }
  return { latest, start, changeKg: roundToTenth(latest.weight_kg - start.weight_kg) }
}

/** The kg scale: at most five ticks on a round step (1, 2, 5 or 10 kg), with a kilo or more of room above and below. */
export function weightTicks(weights: number[]): number[] {
  const low = Math.min(...weights) - 1
  const high = Math.max(...weights) + 1
  const step = [1, 2, 5, 10].find((s) => Math.ceil(high / s) - Math.floor(low / s) <= 4) ?? 20
  const ticks: number[] = []
  for (let kg = Math.floor(low / step) * step; kg <= Math.ceil(high / step) * step; kg += step) ticks.push(kg)
  return ticks
}

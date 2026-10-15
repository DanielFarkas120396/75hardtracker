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

/** An attempt weigh-in with its 7-day average, when that week has enough weigh-ins for one. */
export type TrendWeight = AttemptWeight & { average?: number }

const START_WINDOW_DAYS = 7
const AVERAGE_DAYS = 7
const AVERAGE_MIN_WEIGH_INS = 4

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
 * Adds the 7-day average (the mean of the weigh-ins from 6 days before up to
 * that day) from Day 7 on. It needs 4 weigh-ins in those days, so the average
 * line breaks across long gaps.
 */
export function weightTrend(points: AttemptWeight[]): TrendWeight[] {
  return points.map((point) => {
    if (point.day < AVERAGE_DAYS) return point
    const week = points.filter((p) => p.day > point.day - AVERAGE_DAYS && p.day <= point.day)
    if (week.length < AVERAGE_MIN_WEIGH_INS) return point
    return { ...point, average: week.reduce((sum, p) => sum + p.weight_kg, 0) / week.length }
  })
}

/** The latest weight and the change since the first weigh-in (undefined until there are two). */
export function weightSummary(points: WeightPoint[]): { latest: WeightPoint; changeKg?: number; since?: string } | undefined {
  if (points.length === 0) return undefined
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))
  const first = sorted[0]
  const latest = sorted[sorted.length - 1]
  if (sorted.length === 1) return { latest }
  return { latest, changeKg: roundToTenth(latest.weight_kg - first.weight_kg), since: first.date }
}

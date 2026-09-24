import { isValidISODate } from '../lib/dates'

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

/** The latest weight and the change since the first weigh-in (undefined until there are two). */
export function weightSummary(points: WeightPoint[]): { latest: WeightPoint; changeKg?: number; since?: string } | undefined {
  if (points.length === 0) return undefined
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))
  const first = sorted[0]
  const latest = sorted[sorted.length - 1]
  if (sorted.length === 1) return { latest }
  return { latest, changeKg: roundToTenth(latest.weight_kg - first.weight_kg), since: first.date }
}

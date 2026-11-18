import type { SqlValue } from './driver'
import type { Challenge } from './types'

/**
 * Rows and records. SQLite gives NULL for a column that was never set; the
 * rules expect such a field to be absent (a challenge with no `variant` is
 * 75 Hard). So reading a row drops its NULL columns instead of keeping them.
 */

/** JSON text for a column, or NULL when there is nothing to store. */
export function toJson(value: unknown): string | null {
  return value === undefined ? null : JSON.stringify(value)
}

export function fromJson<T>(text: string | null): T | undefined {
  return text === null ? undefined : (JSON.parse(text) as T)
}

/** NULL becomes "not there". */
export function optional<T>(value: T | null): T | undefined {
  return value === null ? undefined : value
}

/** The record without the fields that are undefined. */
function present<T extends object>(record: T): T {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined)) as T
}

export interface ChallengeRow {
  id: number
  startDate: string
  attemptNumber: number
  status: Challenge['status']
  variant: NonNullable<Challenge['variant']> | null
  socialDays: string | null
  jokersAcknowledged: number | null
  abandonedOn: string | null
  restoredDays: string | null
}

export const INSERT_CHALLENGE = `INSERT INTO challenges
  (startDate, attemptNumber, status, variant, socialDays, jokersAcknowledged, abandonedOn, restoredDays)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`

/** The values for INSERT_CHALLENGE, in its column order. */
export function challengeToParams(challenge: Omit<Challenge, 'id'>): SqlValue[] {
  return [
    challenge.startDate,
    challenge.attemptNumber,
    challenge.status,
    challenge.variant ?? null,
    toJson(challenge.socialDays),
    challenge.jokersAcknowledged ?? null,
    challenge.abandonedOn ?? null,
    toJson(challenge.restoredDays),
  ]
}

export function challengeFromRow(row: ChallengeRow): Challenge {
  return present({
    id: row.id,
    startDate: row.startDate,
    attemptNumber: row.attemptNumber,
    status: row.status,
    variant: optional(row.variant),
    socialDays: fromJson<number[]>(row.socialDays),
    jokersAcknowledged: optional(row.jokersAcknowledged),
    abandonedOn: optional(row.abandonedOn),
    restoredDays: fromJson<number[]>(row.restoredDays),
  })
}

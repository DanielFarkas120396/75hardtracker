import type { SqlValue } from './driver'
import type { Badge, Book, Challenge, DayEntry, Measurement, Photo, Workout } from './types'

/**
 * Rows and records. Column names equal the field names (see schema.ts). SQLite
 * gives NULL for a column that was never set; the rules expect such a field
 * to be absent (a challenge with no `variant` is 75 Hard). So reading a row
 * drops its NULL columns instead of keeping them.
 */

/**
 * How a field is stored: as it is ('value': text or number), as 0 or 1 ('bool'),
 * or as JSON text ('json': lists and small objects).
 */
type Kind = 'value' | 'bool' | 'json'

export type Row = Record<string, SqlValue>

export interface Codec<T extends { id: number }> {
  /** INSERT that lets the database number the row. Pair with `toParams`. */
  insert: string
  /** INSERT that keeps the record's id (imports). Pair with `toParamsWithId`. */
  insertWithId: string
  toParams(record: Omit<T, 'id'>): SqlValue[]
  toParamsWithId(record: T): SqlValue[]
  /** UPDATE of the given fields only; one given as undefined is emptied. Null when there is nothing to change. */
  toUpdate(id: number, changes: Partial<Omit<T, 'id'>>): { sql: string; params: SqlValue[] } | null
  fromRow(row: Row): T
}

function toParam(kind: Kind, value: unknown): SqlValue {
  if (value === undefined || value === null) return null
  if (kind === 'bool') return value ? 1 : 0
  if (kind === 'json') return JSON.stringify(value)
  return value as SqlValue
}

function fromColumn(kind: Kind, value: SqlValue): unknown {
  if (value === null) return undefined
  if (kind === 'bool') return value === 1
  if (kind === 'json') return JSON.parse(value as string)
  return value
}

function codec<T extends { id: number }>(table: string, fields: Record<Exclude<keyof T, 'id'>, Kind>): Codec<T> {
  const names = Object.keys(fields) as Exclude<keyof T & string, 'id'>[]
  const marks = (count: number) => Array.from({ length: count }, () => '?').join(', ')
  const values = (record: Omit<T, 'id'>) =>
    names.map((name) => toParam(fields[name], (record as Record<string, unknown>)[name]))
  return {
    insert: `INSERT INTO ${table} (${names.join(', ')}) VALUES (${marks(names.length)})`,
    insertWithId: `INSERT INTO ${table} (id, ${names.join(', ')}) VALUES (${marks(names.length + 1)})`,
    toParams: values,
    toParamsWithId: (record) => [record.id, ...values(record)],
    toUpdate(id, changes) {
      const changed = names.filter((name) => name in changes)
      if (changed.length === 0) return null
      return {
        sql: `UPDATE ${table} SET ${changed.map((name) => `${name} = ?`).join(', ')} WHERE id = ?`,
        params: [...changed.map((name) => toParam(fields[name], (changes as Record<string, unknown>)[name])), id],
      }
    },
    fromRow(row) {
      const record: Record<string, unknown> = { id: row.id }
      for (const name of names) {
        const value = fromColumn(fields[name], row[name])
        if (value !== undefined) record[name] = value
      }
      return record as T
    },
  }
}

/** One codec per table, named after it. */
export const ROWS = {
  challenges: codec<Challenge>('challenges', {
    startDate: 'value',
    attemptNumber: 'value',
    status: 'value',
    variant: 'value',
    socialDays: 'json',
    jokersAcknowledged: 'value',
    abandonedOn: 'value',
    restoredDays: 'json',
  }),
  dayEntries: codec<DayEntry>('dayEntries', {
    challengeId: 'value',
    date: 'value',
    dayNumber: 'value',
    water_ml: 'value',
    pages_read: 'value',
    dietFollowed: 'bool',
    noAlcohol: 'bool',
    photoId: 'value',
    notes: 'value',
    mood: 'value',
    plans: 'json',
    planEstimates: 'json',
    restDay: 'bool',
    bookId: 'value',
    completed: 'bool',
  }),
  workouts: codec<Workout>('workouts', {
    dayEntryId: 'value',
    type: 'value',
    durationMin: 'value',
    isOutdoor: 'bool',
    feel: 'value',
  }),
  books: codec<Book>('books', {
    title: 'value',
    totalPages: 'value',
    currentPage: 'value',
    finished: 'bool',
    finishedAt: 'value',
    coverFile: 'value',
  }),
  measurements: codec<Measurement>('measurements', {
    date: 'value',
    weight_kg: 'value',
    bodyMeasurements_cm: 'json',
  }),
  photos: codec<Photo>('photos', { date: 'value', file: 'value', mimeType: 'value' }),
  badges: codec<Badge>('badges', { badgeId: 'value', challengeId: 'value', unlockedAt: 'value' }),
}

// The challenge codec under its first names, used by the challenge repository.
export type ChallengeRow = Row
export const INSERT_CHALLENGE = ROWS.challenges.insert
export const challengeToParams = ROWS.challenges.toParams
export const challengeFromRow = ROWS.challenges.fromRow

import { CHALLENGE_LENGTH, WORKOUT_TYPES } from './constants'
import { dayNumberForDate, isValidISODate, todayISO } from './dates'
import { TASK_IDS } from './dayCompletion'
import { parseHHmm } from './menace'
import type { Badge, Book, Challenge, DayEntry, Measurement, SettingsRow, Workout } from './records'
import { backupGapDays, withRestoredDays } from './restoredDays'
import { isChallengeVariant } from './rulesets'

/**
 * The backup file: its shape, the check that a file is one, and the days a
 * backup can't know about. Shared by the web app (src/db/exportImport.ts
 * writes and imports it) and the native app (which imports it).
 */

/** Version of the export file format. Bump it when the format changes incompatibly. */
export const EXPORT_VERSION = 1

export interface ExportedPhoto {
  id: number
  date: string
  blobBase64: string
  mimeType: string
}

/** A book, with its cover (if any) as base64. */
export type ExportedBook = Omit<Book, 'cover'> & { coverBase64?: string; coverMimeType?: string }

export interface ExportPayload {
  version: number
  exportedAt: string
  challenges: Challenge[]
  dayEntries: DayEntry[]
  workouts: Workout[]
  books: ExportedBook[]
  measurements: Measurement[]
  photos: ExportedPhoto[]
  badges: Badge[]
  settings: SettingsRow[]
}

// ---------------------------------------------------------------------------
// Validation

/** The days a backup can't know about, on the attempt it still has running. */
export interface BackupGap {
  challenge: Challenge
  days: number[]
  /** The day the backup was made; below 1 when that was before Day 1. */
  backupDay: number
  todayDayNumber: number
}

export function findBackupGap(payload: ExportPayload, today: string = todayISO()): BackupGap | null {
  const challenge = payload.challenges.reduce<Challenge | undefined>(
    (newest, c) => (newest && newest.attemptNumber > c.attemptNumber ? newest : c),
    undefined,
  )
  const exportedAt = new Date(payload.exportedAt)
  if (challenge?.status !== 'active' || Number.isNaN(exportedAt.getTime())) return null

  const backupDate = todayISO(exportedAt)
  const entries = payload.dayEntries.filter((e) => e.challengeId === challenge.id)
  const summaries = withRestoredDays(
    entries.map((e) => ({ dayNumber: e.dayNumber, completed: e.completed })),
    challenge.restoredDays,
  )
  const days = backupGapDays({ startDate: challenge.startDate, backupDate, today, summaries })
  if (days.length === 0) return null
  return {
    challenge,
    days,
    backupDay: dayNumberForDate(challenge.startDate, backupDate),
    todayDayNumber: dayNumberForDate(challenge.startDate, today),
  }
}

/** The backup with the gap's days marked as done, for the player who says they did them. */
export function withGapRestored(payload: ExportPayload, gap: BackupGap): ExportPayload {
  const challenges = payload.challenges.map((c) =>
    c.id === gap.challenge.id ? { ...c, restoredDays: [...(c.restoredDays ?? []), ...gap.days] } : c,
  )
  return { ...payload, challenges }
}

export type ExportValidation = { ok: true; payload: ExportPayload } | { ok: false; error: string }

type Row = Record<string, unknown>

const isRow = (value: unknown): value is Row => typeof value === 'object' && value !== null && !Array.isArray(value)
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const isString = (value: unknown): value is string => typeof value === 'string'
const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean'
const isOptional = (check: (value: unknown) => boolean) => (value: unknown) => value === undefined || value === null || check(value)

const isDayNumberList = (value: unknown): boolean =>
  Array.isArray(value) && value.every((d) => Number.isInteger(d) && d >= 1 && d <= CHALLENGE_LENGTH)
const isNonNegativeInteger = (value: unknown): boolean => Number.isInteger(value) && (value as number) >= 0
const isWorkoutType = (value: unknown): boolean => (WORKOUT_TYPES as readonly unknown[]).includes(value)
const isFeel = (value: unknown): boolean => value === 1 || value === 2 || value === 3 || value === 4 || value === 5

const isBase64 = (value: unknown): boolean =>
  isString(value) && value.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(value)
const isImageType = (value: unknown): boolean => isString(value) && value.startsWith('image/')

const isPlanMap = (value: unknown): boolean =>
  isRow(value) &&
  Object.entries(value).every(
    ([task, time]) => (TASK_IDS as readonly string[]).includes(task) && isString(time) && parseHHmm(time) !== null,
  )

const isEstimateMap = (value: unknown): boolean =>
  isRow(value) &&
  Object.entries(value).every(
    ([task, minutes]) => (TASK_IDS as readonly string[]).includes(task) && isNumber(minutes) && minutes >= 0,
  )

type FieldChecks = Record<string, (value: unknown) => boolean>

const ROW_CHECKS: Record<Exclude<keyof ExportPayload, 'version' | 'exportedAt'>, FieldChecks> = {
  challenges: {
    id: isNumber,
    startDate: isString,
    attemptNumber: isNumber,
    status: (v) => v === 'active' || v === 'failed' || v === 'completed' || v === 'abandoned',
    variant: isOptional(isChallengeVariant),
    socialDays: isOptional(isDayNumberList),
    restoredDays: isOptional(isDayNumberList),
    jokersAcknowledged: isOptional(isNonNegativeInteger),
    abandonedOn: isOptional((v) => isString(v) && isValidISODate(v)),
  },
  dayEntries: {
    id: isNumber,
    challengeId: isNumber,
    date: isString,
    // Old exports may contain a broken (null) day number; normalizeRecords repairs it from the date.
    dayNumber: isOptional(isNumber),
    water_ml: isNumber,
    pages_read: isNumber,
    dietFollowed: isBoolean,
    noAlcohol: isBoolean,
    completed: isBoolean,
    photoId: isOptional(isNumber),
    plans: isOptional(isPlanMap),
    planEstimates: isOptional(isEstimateMap),
    restDay: isOptional(isBoolean),
    bookId: isOptional(isNumber),
  },
  workouts: {
    id: isNumber,
    dayEntryId: isNumber,
    type: isWorkoutType,
    durationMin: isNumber,
    isOutdoor: isBoolean,
    feel: isOptional(isFeel),
  },
  books: {
    id: isNumber,
    title: isString,
    totalPages: isNumber,
    currentPage: isNumber,
    finished: isBoolean,
    coverBase64: isOptional(isBase64),
    coverMimeType: isOptional(isImageType),
  },
  measurements: { id: isNumber, date: isString, weight_kg: isOptional(isNumber) },
  photos: {
    id: isNumber,
    date: isString,
    blobBase64: isBase64,
    mimeType: isImageType,
  },
  badges: { id: isNumber, badgeId: isString, challengeId: isNumber, unlockedAt: isString },
  settings: { key: isString },
}

const TABLE_LABELS: Record<keyof typeof ROW_CHECKS, string> = {
  challenges: 'an attempt',
  dayEntries: 'a day',
  workouts: 'a workout',
  books: 'a book',
  measurements: 'a measurement',
  photos: 'a photo',
  badges: 'a badge',
  settings: 'a setting',
}

/**
 * Checks that a parsed JSON file is a backup this version of the app can
 * import: a known format version, every table present, rows of the right
 * shape, and photos that are real images encoded as base64.
 */
export function validateExportPayload(value: unknown): ExportValidation {
  const notABackup = { ok: false, error: 'That file doesn’t look like a 75 Hard backup.' } as const
  if (!isRow(value) || !isNumber(value.version)) return notABackup
  if (value.version > EXPORT_VERSION) {
    return { ok: false, error: 'This backup was made by a newer version of the app. Update the app, then try again.' }
  }
  if (value.version < 1 || !Number.isInteger(value.version)) return notABackup

  for (const [table, checks] of Object.entries(ROW_CHECKS) as [keyof typeof ROW_CHECKS, FieldChecks][]) {
    const rows = value[table]
    if (!Array.isArray(rows)) return notABackup
    for (const row of rows) {
      const valid = isRow(row) && Object.entries(checks).every(([field, check]) => check(row[field]))
      if (!valid) {
        return {
          ok: false,
          error:
            table === 'photos' && isRow(row) && isString(row.mimeType) && !row.mimeType.startsWith('image/')
              ? 'That backup contains a “photo” that isn’t an image, so it wasn’t imported.'
              : `That backup has ${TABLE_LABELS[table]} it can’t read, so it wasn’t imported.`,
        }
      }
    }
  }

  return { ok: true, payload: value as unknown as ExportPayload }
}


import { isValidISODate, todayISO } from '../lib/dates'
import { CHALLENGE_LENGTH, WORKOUT_TYPES } from '../logic/constants'
import { TASK_IDS } from '../logic/dayCompletion'
import { parseHHmm } from '../logic/menace'
import { isChallengeVariant } from '../logic/rulesets'
import { db } from './db'
import { normalizeRecords } from './normalize'
import { DEVICE_SETTING_KEYS, SETTING_KEYS } from './repositories/settingsRepo'
import type { Badge, Book, Challenge, DayEntry, Measurement, Photo, SettingsRow, Workout } from './types'

/** Version of the export file format. Bump it when the format changes incompatibly. */
export const EXPORT_VERSION = 1

interface ExportedPhoto {
  id: number
  date: string
  blobBase64: string
  mimeType: string
}

/** A book, with its cover (if any) as base64. */
type ExportedBook = Omit<Book, 'cover'> & { coverBase64?: string; coverMimeType?: string }

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

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mimeType })
}

/** Serializes every table, including photo blobs as base64, into one JSON-able payload. */
export async function exportAll(): Promise<ExportPayload> {
  const [challenges, dayEntries, workouts, books, measurements, photos, badges, settings] = await Promise.all([
    db.challenges.toArray(),
    db.dayEntries.toArray(),
    db.workouts.toArray(),
    db.books.toArray(),
    db.measurements.toArray(),
    db.photos.toArray(),
    db.badges.toArray(),
    db.settings.toArray(),
  ])

  const exportedPhotos: ExportedPhoto[] = await Promise.all(
    photos.map(async (p) => ({
      id: p.id,
      date: p.date,
      blobBase64: await blobToBase64(p.blob),
      mimeType: p.blob.type || 'image/jpeg',
    })),
  )

  const exportedBooks: ExportedBook[] = await Promise.all(
    books.map(async ({ cover, ...book }) =>
      cover ? { ...book, coverBase64: await blobToBase64(cover), coverMimeType: cover.type || 'image/jpeg' } : book,
    ),
  )

  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    challenges,
    dayEntries,
    workouts,
    books: exportedBooks,
    measurements,
    photos: exportedPhotos,
    badges,
    // The Face ID lock belongs to this phone: its passkey can't work anywhere else.
    settings: settings.filter((row) => !DEVICE_SETTING_KEYS.includes(row.key)),
  }
}

/** Records a successful backup, for the "last backup N days ago" reminder. */
export async function markExported(at: string = new Date().toISOString()): Promise<void> {
  await db.settings.put({ key: SETTING_KEYS.lastExportAt, value: at })
}

// ---------------------------------------------------------------------------
// Validation

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

// ---------------------------------------------------------------------------
// Import / reset

/**
 * Replaces all local data with the given (validated) export payload, in one
 * transaction. Duplicates left by older versions are repaired on the way in
 * (see normalizeRecords), so older backups still import under the v3 unique
 * indexes. Destructive — callers confirm with the user first.
 */
export async function importAll(payload: ExportPayload): Promise<void> {
  // Decode photos before the transaction starts: a bad file fails here,
  // with the existing data untouched.
  const photos: Photo[] = payload.photos.map((p) => ({
    id: p.id,
    date: p.date,
    blob: base64ToBlob(p.blobBase64, p.mimeType),
  }))
  const books: Book[] = payload.books.map(({ coverBase64, coverMimeType, ...book }) =>
    coverBase64 ? { ...book, cover: base64ToBlob(coverBase64, coverMimeType ?? 'image/jpeg') } : book,
  )

  const normalized = normalizeRecords(
    {
      challenges: payload.challenges,
      dayEntries: payload.dayEntries,
      workouts: payload.workouts,
      badges: payload.badges,
    },
    todayISO(),
  )

  // The imported data is exactly this backup, so it counts as backed up then.
  // This device's own settings (the Face ID lock) stay as they are, whatever the backup holds.
  const deviceSettings = (await db.settings.bulkGet([...DEVICE_SETTING_KEYS])).filter((row) => row !== undefined)
  const settings = [
    ...payload.settings.filter((row) => row.key !== SETTING_KEYS.lastExportAt && !DEVICE_SETTING_KEYS.includes(row.key)),
    { key: SETTING_KEYS.lastExportAt, value: payload.exportedAt },
    ...deviceSettings,
  ]

  const tables = [
    db.challenges,
    db.dayEntries,
    db.workouts,
    db.books,
    db.measurements,
    db.photos,
    db.badges,
    db.settings,
  ]

  await db.transaction('rw', tables, async () => {
    await Promise.all(tables.map((table) => table.clear()))
    await Promise.all([
      db.challenges.bulkAdd(normalized.challenges),
      db.dayEntries.bulkAdd(normalized.dayEntries),
      db.workouts.bulkAdd(normalized.workouts),
      db.books.bulkAdd(books),
      db.measurements.bulkAdd(payload.measurements),
      db.photos.bulkAdd(photos),
      db.badges.bulkAdd(normalized.badges),
      db.settings.bulkAdd(settings),
    ])
  })
}

/** Deletes all local data, resetting the app to a first-launch state. */
export async function resetAll(): Promise<void> {
  const tables = [
    db.challenges,
    db.dayEntries,
    db.workouts,
    db.books,
    db.measurements,
    db.photos,
    db.badges,
    db.settings,
  ]
  await db.transaction('rw', tables, async () => {
    await Promise.all(tables.map((table) => table.clear()))
  })
}

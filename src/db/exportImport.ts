import { db } from './db'
import type { Badge, Book, Challenge, DayEntry, Measurement, SettingsRow, Workout } from './types'

const EXPORT_VERSION = 1

interface ExportedPhoto {
  id: number
  date: string
  blobBase64: string
  mimeType: string
}

export interface ExportPayload {
  version: number
  exportedAt: string
  challenges: Challenge[]
  dayEntries: DayEntry[]
  workouts: Workout[]
  books: Book[]
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

  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    challenges,
    dayEntries,
    workouts,
    books,
    measurements,
    photos: exportedPhotos,
    badges,
    settings,
  }
}

export function isValidExportPayload(value: unknown): value is ExportPayload {
  if (!value || typeof value !== 'object') return false
  const arrayKeys = [
    'challenges',
    'dayEntries',
    'workouts',
    'books',
    'measurements',
    'photos',
    'badges',
    'settings',
  ] as const
  return arrayKeys.every((key) => Array.isArray((value as Record<string, unknown>)[key]))
}

/**
 * Replaces all local data with the given export payload, in one
 * transaction. Destructive — callers should confirm with the user first.
 */
export async function importAll(payload: ExportPayload): Promise<void> {
  const photos = payload.photos.map((p) => ({
    id: p.id,
    date: p.date,
    blob: base64ToBlob(p.blobBase64, p.mimeType),
  }))

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
      db.challenges.bulkAdd(payload.challenges),
      db.dayEntries.bulkAdd(payload.dayEntries),
      db.workouts.bulkAdd(payload.workouts),
      db.books.bulkAdd(payload.books),
      db.measurements.bulkAdd(payload.measurements),
      db.photos.bulkAdd(photos),
      db.badges.bulkAdd(payload.badges),
      db.settings.bulkAdd(payload.settings),
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

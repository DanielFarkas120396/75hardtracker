import { todayISO } from '../lib/dates'
import { EXPORT_VERSION, type ExportedBook, type ExportedPhoto, type ExportPayload } from '../logic/backupFormat'
import { db } from './db'
import { normalizeRecords } from './normalize'
import { DEVICE_SETTING_KEYS, SETTING_KEYS } from './repositories/settingsRepo'
import type { Book, Photo } from './types'

export * from '../logic/backupFormat'

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

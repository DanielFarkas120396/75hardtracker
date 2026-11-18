import type { ExportPayload } from '@logic/backupFormat'
import { normalizeRecords } from '@logic/normalize'
import { DEVICE_SETTING_KEYS, SETTING_KEYS } from '@logic/settingKeys'
import type { SqlValue } from '../db/driver'
import { transaction } from '../db/open'
import { ROWS } from '../db/rows'
import { TABLE_NAMES } from '../db/schema'
import type { Book, Photo } from '../db/types'
import { commitStaged, discardStaged, stagePictures, type StagedPicture } from '../files/pictures'
import type { FileStore } from '../files/store'

/**
 * Replaces everything on the phone with a backup exported by the web app (a
 * validated payload). The same rules as the web app's importAll
 * (src/db/exportImport.ts): old data is repaired on the way in, the data
 * counts as backed up when the file was made, and this phone's own settings
 * (its lock) stay as they are.
 *
 * Nothing changes unless all of it works: the pictures are written beside the
 * current ones first, the rows are replaced in one transaction, and only then
 * are the pictures swapped. Destructive: callers confirm with the user first.
 */
export async function importBackup(payload: ExportPayload, store: FileStore, today: string): Promise<void> {
  const pictures: StagedPicture[] = [
    ...payload.photos.map((photo) => ({
      folder: 'photos' as const,
      id: photo.id,
      base64: photo.blobBase64,
      mimeType: photo.mimeType,
    })),
    ...payload.books.flatMap((book) =>
      book.coverBase64
        ? [{ folder: 'covers' as const, id: book.id, base64: book.coverBase64, mimeType: book.coverMimeType ?? 'image/jpeg' }]
        : [],
    ),
  ]

  try {
    const files = await stagePictures(store, pictures)

    const normalized = normalizeRecords(
      {
        challenges: payload.challenges,
        dayEntries: payload.dayEntries,
        workouts: payload.workouts,
        badges: payload.badges,
      },
      today,
    )
    const photos: Photo[] = payload.photos.map((photo) => ({
      id: photo.id,
      date: photo.date,
      file: files.get(`photos/${photo.id}`)!,
      mimeType: photo.mimeType,
    }))
    const books: Book[] = payload.books.map(({ coverBase64: _data, coverMimeType: _type, ...book }) => {
      const coverFile = files.get(`covers/${book.id}`)
      return coverFile ? { ...book, coverFile } : book
    })
    const settings = payload.settings.filter(
      (row) => row.key !== SETTING_KEYS.lastExportAt && !DEVICE_SETTING_KEYS.includes(row.key),
    )

    await transaction(async (db) => {
      const marks = DEVICE_SETTING_KEYS.map(() => '?').join(', ')
      const ownSettings = await db.getAllAsync<{ key: string; value: string }>(
        `SELECT key, value FROM settings WHERE key IN (${marks})`,
        [...DEVICE_SETTING_KEYS],
      )
      for (const table of TABLE_NAMES) await db.execAsync(`DELETE FROM ${table}`)

      const insertAll = async <T extends { id: number }>(
        codec: { insertWithId: string; toParamsWithId(record: T): SqlValue[] },
        records: readonly T[],
      ) => {
        for (const record of records) await db.runAsync(codec.insertWithId, codec.toParamsWithId(record))
      }
      await insertAll(ROWS.challenges, normalized.challenges)
      await insertAll(ROWS.dayEntries, normalized.dayEntries)
      await insertAll(ROWS.workouts, normalized.workouts)
      await insertAll(ROWS.books, books)
      await insertAll(ROWS.measurements, payload.measurements)
      await insertAll(ROWS.photos, photos)
      await insertAll(ROWS.badges, normalized.badges)

      const insertSetting = 'INSERT INTO settings (key, value) VALUES (?, ?)'
      for (const row of settings) await db.runAsync(insertSetting, [row.key, JSON.stringify(row.value ?? null)])
      await db.runAsync(insertSetting, [SETTING_KEYS.lastExportAt, JSON.stringify(payload.exportedAt)])
      for (const row of ownSettings) await db.runAsync(insertSetting, [row.key, row.value])
    })
  } catch (error) {
    discardStaged(store)
    throw error
  }

  // ponytail: the rows are in and the swap is two renames. If a rename failed here the rows
  // would point at pictures still in pictures-incoming; a repair step at launch if that is ever seen.
  commitStaged(store)
}

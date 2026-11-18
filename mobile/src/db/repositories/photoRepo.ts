import { extensionFor, picturePath } from '../../files/pictures'
import type { FileStore } from '../../files/store'
import { syncDayCompletion } from '../completion'
import { getDb, transaction } from '../open'
import { allRows, getRow, insertRow, updateRow } from '../table'
import type { Photo } from '../types'

/**
 * The progress photos. Same calls and behaviour as the web app's photoRepo
 * (src/db/repositories/photoRepo.ts), except that a picture is a file
 * (pictures/photos/<photo id>.<ext>) and its row holds the file's name. The
 * Gallery's reads arrive with the Gallery.
 */
export const photoRepo = {
  async getById(id: number): Promise<Photo | undefined> {
    return getRow(getDb(), 'photos', id)
  },

  /** The most recent photo dated strictly before `date`: the camera's alignment ghost. */
  async getLatestBefore(date: string): Promise<Photo | undefined> {
    return (await allRows(getDb(), 'photos', 'WHERE date < ? ORDER BY date DESC, id DESC LIMIT 1', [date]))[0]
  },

  /**
   * Stores the picture at `picture.uri` as the day's progress photo. A retake
   * deletes the photo it replaces (its row in the same transaction, its file
   * once that is saved), and the day's completion is re-synced.
   */
  async replaceForEntry(entryId: number, picture: { uri: string; mimeType: string }, store: FileStore): Promise<number> {
    const saved = await transaction(async (db) => {
      const entry = await getRow(db, 'dayEntries', entryId)
      if (!entry) throw new Error(`Day entry ${entryId} not found`)

      // The file is named after the row, so the row comes first. If anything below fails the row is
      // undone; a file already copied is then replaced by the next photo, which gets the same id.
      const photoId = await insertRow(db, 'photos', { date: entry.date, file: '', mimeType: picture.mimeType })
      const file = `${photoId}.${extensionFor(picture.mimeType)}`
      await store.copyIn(picture.uri, picturePath('photos', file))
      await updateRow(db, 'photos', photoId, { file })
      await updateRow(db, 'dayEntries', entryId, { photoId })

      const replaced = entry.photoId != null && entry.photoId !== photoId ? await getRow(db, 'photos', entry.photoId) : undefined
      if (replaced) await db.runAsync('DELETE FROM photos WHERE id = ?', [replaced.id])
      await syncDayCompletion(db, entryId)
      return { photoId, replaced }
    })
    // Only now: a save that failed must leave the old picture where it was.
    if (saved.replaced) store.deleteFile(picturePath('photos', saved.replaced.file))
    return saved.photoId
  },
}

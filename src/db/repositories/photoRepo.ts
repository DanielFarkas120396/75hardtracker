import { syncDayCompletion } from '../completion'
import { db } from '../db'
import type { Photo } from '../types'

export const photoRepo = {
  async getById(id: number): Promise<Photo | undefined> {
    return db.photos.get(id)
  },

  async getByIds(ids: number[]): Promise<(Photo | undefined)[]> {
    return db.photos.bulkGet(ids)
  },

  async getAll(): Promise<Photo[]> {
    return db.photos.orderBy('date').toArray()
  },

  /**
   * Stores `blob` as the day's progress photo. A retake deletes the photo it
   * replaces in the same transaction (so no orphaned blob is left behind),
   * and the day's completion is re-synced.
   */
  async replaceForEntry(entryId: number, blob: Blob): Promise<number> {
    return db.transaction('rw', [db.photos, db.dayEntries, db.workouts], async () => {
      const entry = await db.dayEntries.get(entryId)
      if (!entry) throw new Error(`Day entry ${entryId} not found`)

      const photoId = await db.photos.add({ date: entry.date, blob } as Photo)
      await db.dayEntries.update(entryId, { photoId })
      if (entry.photoId != null && entry.photoId !== photoId) {
        await db.photos.delete(entry.photoId)
      }
      await syncDayCompletion(entryId)
      return photoId
    })
  },
}

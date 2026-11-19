import { photoRepo } from '../db/repositories/photoRepo'
import type { DayEntry } from '../db/types'
import { useLiveQuery } from '../db/useLiveQuery'
import { pictureUri } from '../files/pictures'
import { expoStore } from '../files/store'

export interface GalleryEntry {
  /** The photo's id (what Compare picks by) and its picture as a file to show. */
  photo: { id: number; uri: string }
  dayNumber: number
  attemptNumber: number
  date: string
}

/**
 * One attempt's progress photos, newest first: its days with a photo, their photo rows in one read. The web's
 * useGalleryPhotos(challengeId) (src/hooks/useGalleryPhotos.ts); the entries come from the app's gate.
 */
export function useGalleryPhotos(dayEntries: readonly DayEntry[], attemptNumber: number): GalleryEntry[] | undefined {
  const withPhoto = dayEntries.filter((e) => e.photoId != null)
  const ids = withPhoto.map((e) => e.photoId!)
  return useLiveQuery(async () => {
    const photos = new Map((await photoRepo.getMany(ids)).map((photo) => [photo.id, photo]))
    return withPhoto
      .flatMap((entry) => {
        const photo = photos.get(entry.photoId!)
        return photo ? [{ photo: { id: photo.id, uri: pictureUri(expoStore, 'photos', photo.file) }, dayNumber: entry.dayNumber, attemptNumber, date: entry.date }] : []
      })
      .sort((a, b) => b.dayNumber - a.dayNumber)
    // The day entries' photos say what to read: a new photo or a retake changes them.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [withPhoto.map((e) => `${e.dayNumber}:${e.photoId}`).join(','), attemptNumber])
}

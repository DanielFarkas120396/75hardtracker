import { useLiveQuery } from 'dexie-react-hooks'
import { challengeRepo } from '../db/repositories/challengeRepo'
import { dayEntryRepo } from '../db/repositories/dayEntryRepo'
import { photoRepo } from '../db/repositories/photoRepo'
import type { Photo } from '../db/types'

export interface GalleryEntry {
  photo: Photo
  dayNumber: number
  attemptNumber: number
  date: string
}

/** Every progress photo ever taken, across all attempts, newest first. */
export function useGalleryPhotos(): GalleryEntry[] | undefined {
  return useLiveQuery(async () => {
    const [entries, challenges] = await Promise.all([dayEntryRepo.getAllWithPhoto(), challengeRepo.getAll()])
    const attemptByChallengeId = new Map(challenges.map((c) => [c.id, c.attemptNumber]))

    const results: GalleryEntry[] = []
    for (const entry of entries) {
      const photo = await photoRepo.getById(entry.photoId!)
      if (!photo) continue
      results.push({
        photo,
        dayNumber: entry.dayNumber,
        attemptNumber: attemptByChallengeId.get(entry.challengeId) ?? 0,
        date: entry.date,
      })
    }

    results.sort((a, b) => b.attemptNumber - a.attemptNumber || b.dayNumber - a.dayNumber)
    return results
  }, [])
}

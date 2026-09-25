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

/** Progress photos, newest first: every one ever taken, or only one attempt's when `challengeId` is given. */
export function useGalleryPhotos(challengeId?: number): GalleryEntry[] | undefined {
  return useLiveQuery(async () => {
    const [entries, challenges] = await Promise.all([
      challengeId === undefined
        ? dayEntryRepo.getAllWithPhoto()
        : dayEntryRepo.getAllForChallenge(challengeId).then((all) => all.filter((e) => e.photoId != null)),
      challengeRepo.getAll(),
    ])
    const attemptByChallengeId = new Map(challenges.map((c) => [c.id, c.attemptNumber]))
    const photos = await photoRepo.getByIds(entries.map((e) => e.photoId!))

    const results: GalleryEntry[] = []
    entries.forEach((entry, i) => {
      const photo = photos[i]
      if (!photo) return
      results.push({
        photo,
        dayNumber: entry.dayNumber,
        attemptNumber: attemptByChallengeId.get(entry.challengeId) ?? 0,
        date: entry.date,
      })
    })

    results.sort((a, b) => b.attemptNumber - a.attemptNumber || b.dayNumber - a.dayNumber)
    return results
  }, [challengeId])
}

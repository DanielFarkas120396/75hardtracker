import { useLiveQuery } from 'dexie-react-hooks'
import { photoRepo } from '../db/repositories/photoRepo'
import type { Photo } from '../db/types'

/** The photo row a day entry points to, live; undefined while loading or without one. */
export function useEntryPhoto(photoId: number | null | undefined): Photo | undefined {
  return useLiveQuery(async () => (photoId == null ? undefined : photoRepo.getById(photoId)), [photoId])
}

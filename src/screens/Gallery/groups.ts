import type { GalleryEntry } from '../../hooks/useGalleryPhotos'
import { worldForDay, type World } from '../Journey/worlds'

export interface GalleryGroup {
  key: string
  world: World
  attemptNumber: number
  /** The group's photos, each with its place in the whole list (for the lightbox). */
  items: { entry: GalleryEntry; index: number }[]
}

/**
 * Splits the gallery (newest first) into runs of photos from the same world
 * of the same attempt, keeping the order.
 */
export function groupByWorld(entries: readonly GalleryEntry[]): GalleryGroup[] {
  const groups: GalleryGroup[] = []
  entries.forEach((entry, index) => {
    const world = worldForDay(entry.dayNumber)
    const last = groups.at(-1)
    if (last && last.world.id === world.id && last.attemptNumber === entry.attemptNumber) {
      last.items.push({ entry, index })
    } else {
      groups.push({ key: `${entry.attemptNumber}-${world.id}`, world, attemptNumber: entry.attemptNumber, items: [{ entry, index }] })
    }
  })
  return groups
}

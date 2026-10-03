import { describe, expect, it } from 'vitest'
import type { GalleryEntry } from '../../../hooks/useGalleryPhotos'
import { groupByWorld } from '../groups'

const photo = (attemptNumber: number, dayNumber: number): GalleryEntry => ({
  photo: { id: attemptNumber * 100 + dayNumber, date: '2026-09-01', blob: new Blob() },
  dayNumber,
  attemptNumber,
  date: '2026-09-01',
})

describe('groupByWorld', () => {
  it('groups photos by the world of their day, newest first, per attempt', () => {
    const entries = [photo(2, 12), photo(2, 11), photo(2, 3), photo(1, 40), photo(1, 2)]
    const groups = groupByWorld(entries)

    expect(groups.map((g) => [g.attemptNumber, g.world.id])).toEqual([
      [2, 'wasteland'],
      [2, 'hell'],
      [1, 'meadow'],
      [1, 'hell'],
    ])
    expect(groups[0].items.map((i) => i.index)).toEqual([0, 1])
    expect(groups[3].items[0].index).toBe(4)
  })

  it('has nothing to group without photos', () => {
    expect(groupByWorld([])).toEqual([])
  })
})

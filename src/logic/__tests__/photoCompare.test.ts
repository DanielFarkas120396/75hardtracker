import { describe, expect, it } from 'vitest'
import { comparePair, frameMs } from '../photoCompare'

const photos = [1, 3, 5, 7].map((dayNumber) => ({ dayNumber, photo: { id: dayNumber * 10 } }))
const days = (pair: readonly { dayNumber: number }[]) => pair.map((p) => p.dayNumber)

describe('comparePair', () => {
  it('opens on the first and the latest photo', () => {
    expect(days(comparePair(photos))).toEqual([1, 7])
  })

  it('shows the picked photos', () => {
    expect(days(comparePair(photos, 30, 50))).toEqual([3, 5])
  })

  it('keeps the earlier day first when the picks are the wrong way round', () => {
    expect(days(comparePair(photos, 50, 30))).toEqual([3, 5])
  })

  it('falls back to the first or the latest photo when a picked one is gone', () => {
    expect(days(comparePair(photos, 30, 99))).toEqual([3, 7])
    expect(days(comparePair(photos, 99, 50))).toEqual([1, 5])
  })

  it('never shows the same photo on both sides', () => {
    expect(days(comparePair(photos, 70, 99))).toEqual([1, 7])
  })
})

describe('frameMs', () => {
  it('spreads the time-lapse over about 4 s', () => {
    expect(frameMs(10)).toBe(400)
    expect(frameMs(20)).toBe(200)
  })

  it('keeps each photo on screen between 80 and 400 ms', () => {
    expect(frameMs(2)).toBe(400)
    expect(frameMs(75)).toBe(80)
  })
})

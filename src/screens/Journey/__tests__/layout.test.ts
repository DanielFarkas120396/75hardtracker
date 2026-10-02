import { describe, expect, it } from 'vitest'
import { CHALLENGE_LENGTH } from '../../../logic/constants'
import { MAP_HEIGHT, MAP_WIDTH, roadPath, scenerySide, seeded, worldBand, xForDay, yForDay } from '../layout'
import { WORLDS } from '../worlds'

describe('Journey layout', () => {
  it('climbs: Day 1 at the bottom, Day 75 at the top, each day above the last', () => {
    for (let day = 2; day <= CHALLENGE_LENGTH; day++) expect(yForDay(day)).toBeLessThan(yForDay(day - 1))
    expect(yForDay(1)).toBeLessThan(MAP_HEIGHT)
    expect(yForDay(CHALLENGE_LENGTH)).toBeGreaterThan(0)
  })

  it('keeps every day inside the map width', () => {
    for (let day = 1; day <= CHALLENGE_LENGTH; day++) {
      expect(xForDay(day)).toBeGreaterThan(30)
      expect(xForDay(day)).toBeLessThan(MAP_WIDTH - 30)
    }
  })

  it('puts scenery on the side the road has swung away from', () => {
    const day = 2 // swung right of centre
    expect(xForDay(day)).toBeGreaterThan(MAP_WIDTH / 2)
    expect(scenerySide(day)).toBe('left')
  })

  it('stacks the world bands edge to edge over the whole map', () => {
    expect(worldBand(0).bottom).toBe(MAP_HEIGHT)
    expect(worldBand(WORLDS.length - 1).top).toBe(0)
    for (let i = 1; i < WORLDS.length; i++) expect(worldBand(i).bottom).toBe(worldBand(i - 1).top)
  })

  it('draws the road as one smooth path through all 75 days', () => {
    const path = roadPath()
    expect(path.startsWith('M')).toBe(true)
    expect(path.match(/C/g)).toHaveLength(CHALLENGE_LENGTH + 1)
  })

  it('lays the scenery out the same way every time', () => {
    expect(seeded(12, 3)).toBe(seeded(12, 3))
    expect(seeded(12, 3)).toBeGreaterThanOrEqual(0)
    expect(seeded(12, 3)).toBeLessThan(1)
  })
})

import { describe, expect, it } from 'vitest'
import { CHALLENGE_LENGTH } from '../../../logic/constants'
import { WORLDS, worldForDay } from '../worlds'

describe('WORLDS', () => {
  it('covers days 1 to 75 in order, with no gaps or overlaps', () => {
    expect(WORLDS[0].firstDay).toBe(1)
    expect(WORLDS[WORLDS.length - 1].lastDay).toBe(CHALLENGE_LENGTH)
    for (let i = 1; i < WORLDS.length; i++) {
      expect(WORLDS[i].firstDay).toBe(WORLDS[i - 1].lastDay + 1)
    }
  })

  it('climbs from hell to heaven', () => {
    expect(WORLDS.map((w) => w.id)).toEqual(['hell', 'wasteland', 'forest', 'meadow', 'mountains', 'heaven'])
  })
})

describe('worldForDay', () => {
  it('finds the world at each boundary', () => {
    expect(worldForDay(1).id).toBe('hell')
    expect(worldForDay(10).id).toBe('hell')
    expect(worldForDay(11).id).toBe('wasteland')
    expect(worldForDay(64).id).toBe('mountains')
    expect(worldForDay(65).id).toBe('heaven')
    expect(worldForDay(75).id).toBe('heaven')
  })

  it('puts out-of-range days at the nearest end', () => {
    expect(worldForDay(0).id).toBe('hell')
    expect(worldForDay(99).id).toBe('heaven')
  })
})

import { describe, expect, it } from 'vitest'
import { climbSegments } from '../climb'

describe('climbSegments', () => {
  it('splits the 75 days between the six worlds', () => {
    const segments = climbSegments(0)
    expect(segments.map((s) => s.id)).toEqual(['hell', 'wasteland', 'forest', 'meadow', 'mountains', 'heaven'])
    expect(segments.reduce((sum, s) => sum + s.share, 0)).toBeCloseTo(1)
    expect(segments.every((s) => s.fill === 0)).toBe(true)
  })

  it('fills the worlds passed and part of the current one', () => {
    const [hell, wasteland, forest] = climbSegments(16)
    expect(hell.fill).toBe(1)
    expect(wasteland.fill).toBeCloseTo(6 / 12)
    expect(forest.fill).toBe(0)
  })

  it('fills everything at the end, and nothing for a broken date', () => {
    expect(climbSegments(75).every((s) => s.fill === 1)).toBe(true)
    expect(climbSegments(Number.NaN).every((s) => s.fill === 0)).toBe(true)
  })
})

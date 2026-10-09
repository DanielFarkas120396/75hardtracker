import { describe, expect, it } from 'vitest'
import { WORLD_COLORS } from '../../../../lib/worldColors'
import { createInk, inkRadius } from '../ink'
import { fillPalette } from '../palette'

describe('ink fill', () => {
  it('reaches further for more of the tile, and past its far corner when full', () => {
    const origin: [number, number] = [50, 0]
    const half = inkRadius(0.5, 173, 120, origin, 0)
    expect(inkRadius(0.25, 173, 120, origin, 0)).toBeLessThan(half)
    expect(inkRadius(1, 173, 120, origin, 10)).toBeGreaterThan(Math.hypot(173 / 2 + 50, 60))
    expect(inkRadius(0, 173, 120, origin, 10)).toBeLessThan(0)
  })

  it('spreads in the chosen 1.1 s', () => {
    const ink = createInk(fillPalette(WORLD_COLORS.forest.dark, 'dark'))
    ink.setLevel(0.5, false)
    for (let i = 0; i < 66; i++) ink.step(1 / 60, true)
    expect(ink.settled()).toBe(true)
    expect(ink.shown()).toBeCloseTo(0.5)
    ink.dispose()
  })
})

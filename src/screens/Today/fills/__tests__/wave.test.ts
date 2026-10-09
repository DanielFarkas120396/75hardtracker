import { describe, expect, it } from 'vitest'
import { WORLD_COLORS } from '../../../../lib/worldColors'
import { fillPalette } from '../palette'
import { createWave, waveSurfaceY } from '../wave'

describe('water fill', () => {
  it('hides the surface, waves and all, under an empty tile and lifts it past the top when full', () => {
    expect(waveSurfaceY(0, 120) + 8.5).toBeLessThan(-60)
    expect(waveSurfaceY(1, 120) - 2 * 8.5).toBeGreaterThan(60)
  })

  it('rises to its level in the chosen 2.4 s, then has settled', () => {
    const wave = createWave(fillPalette(WORLD_COLORS.forest.dark, 'dark'))
    wave.setLevel(0.5, false)
    expect(wave.settled()).toBe(false)
    for (let i = 0; i < 60; i++) wave.step(1 / 60, true)
    expect(wave.shown()).toBeGreaterThan(0.2)
    expect(wave.shown()).toBeLessThan(0.5)
    for (let i = 0; i < 60 * 2; i++) wave.step(1 / 60, true)
    expect(wave.shown()).toBeCloseTo(0.5)
    expect(wave.settled()).toBe(true)
    expect(wave.drifts()).toBe(true)
    wave.dispose()
  })

  it('jumps to a level set at once', () => {
    const wave = createWave(fillPalette(WORLD_COLORS.forest.dark, 'dark'))
    wave.setLevel(1, true)
    expect(wave.shown()).toBe(1)
    expect(wave.settled()).toBe(true)
    wave.dispose()
  })
})

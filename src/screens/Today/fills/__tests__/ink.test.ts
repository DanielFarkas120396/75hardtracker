import type { Mesh, Scene, ShaderMaterial, WebGLRenderer } from 'three'
import { describe, expect, it } from 'vitest'
import { WORLD_COLORS } from '../../../../lib/worldColors'
import { createInk, inkRadius } from '../ink'
import type { Painter } from '../painter'
import { fillPalette } from '../palette'

/** Renders the ink on a 343 × 120 tile through a stand-in renderer and returns the edge's radius it drew. */
function drawnRadius(ink: Painter): number {
  let radius = NaN
  const renderer = {
    render(scene: Scene) {
      radius = ((scene.children[0] as Mesh).material as ShaderMaterial).uniforms.uR.value as number
    },
  } as unknown as WebGLRenderer
  ink.render(renderer, 343, 120)
  return radius
}

/** Steps and draws `frames` frames at 60 fps, as the engine does while the ink moves. */
function play(ink: Painter, frames: number): number {
  let radius = drawnRadius(ink)
  for (let i = 0; i < frames; i++) {
    ink.step(1 / 60, true)
    radius = drawnRadius(ink)
  }
  return radius
}

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

  it('carries on from where its edge is when a tap interrupts a spread, in both directions', () => {
    const ink = createInk(fillPalette(WORLD_COLORS.forest.dark, 'dark'))
    ink.setLevel(0, true)
    ink.setLevel(0.5, false)
    // The plate undone 0.3 of the way into its spread: the edge eases back from where it is.
    const before = play(ink, 20)
    ink.setLevel(0, false)
    expect(drawnRadius(ink)).toBeCloseTo(before)
    expect(Math.abs(play(ink, 1) - before)).toBeLessThan(12)

    // The glass ticked while the plate's spread is under way: the edge carries on forward.
    ink.setLevel(0.5, true)
    play(ink, 1)
    ink.setLevel(1, false)
    const going = play(ink, 10)
    ink.setLevel(0.5, false)
    expect(drawnRadius(ink)).toBeCloseTo(going)
    expect(Math.abs(play(ink, 1) - going)).toBeLessThan(12)
    ink.dispose()
  })

  it('spreads from the level it was set to at once, even before that level was drawn', () => {
    const ink = createInk(fillPalette(WORLD_COLORS.forest.dark, 'dark'))
    ink.setAnchor?.(56, 60)
    ink.setLevel(0.5, true)
    ink.setLevel(1, false)
    expect(drawnRadius(ink)).toBeCloseTo(inkRadius(0.5, 343, 120, [343 / 2 - 56, 0], 0))
    ink.dispose()
  })
})

import { describe, expect, it } from 'vitest'
import { WORLD_COLORS } from '../../../../lib/worldColors'
import { WORLDS } from '../../../Journey/worlds'
import { FILL_LOOK, fillOpacity, fillPalette, rgb, textContrastOver, toHex } from '../palette'
import type { PainterKind } from '../painter'

const KINDS = Object.keys(FILL_LOOK) as PainterKind[]

describe('fill palette', () => {
  it('reads and writes hex colours', () => {
    expect(toHex(rgb('#7fb08a'))).toBe('#7fb08a')
  })

  it('gives back the forest greens the fills were chosen in', () => {
    const forest = fillPalette(WORLD_COLORS.forest.dark, 'dark')
    expect(toHex(forest.mid)).toBe('#7fb08a')
    // The water prototype's top (0.55, 0.74, 0.59) and deep (0.2, 0.34, 0.25), give or take.
    forest.top.forEach((v, i) => expect(v).toBeCloseTo([0.55, 0.74, 0.59][i], 1))
    forest.deep.forEach((v, i) => expect(v).toBeCloseTo([0.2, 0.34, 0.25][i], 1))
  })

  for (const mode of ['light', 'dark'] as const) {
    it.each(WORLDS.map((w) => w.id))(`keeps the tile's text at 4.5:1 over every fill in %s (${mode})`, (id) => {
      const palette = fillPalette(WORLD_COLORS[id][mode], mode)
      for (const kind of KINDS) {
        const opacity = fillOpacity(kind, palette)
        expect(textContrastOver(palette, opacity * FILL_LOOK[kind].body)).toBeGreaterThanOrEqual(4.5)
        // Never so faint that the fill disappears.
        expect(opacity).toBeGreaterThanOrEqual(0.3)
      }
    })
  }
})

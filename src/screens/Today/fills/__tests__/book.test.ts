import { describe, expect, it } from 'vitest'
import { contrastRatio, SURFACE, WORLD_COLORS } from '../../../../lib/worldColors'
import { WORLDS } from '../../../Journey/worlds'
import { createBook, riffleGap, spineShade } from '../book'
import { FILL_LOOK, fillOpacity, fillPalette, mix, rgb, TILE_INK, toHex } from '../palette'

describe('book fill', () => {
  it('turns one page at the calm pace, and riffles several, all starting within 2.4 s', () => {
    expect(riffleGap(1)).toBeCloseTo(0.99)
    expect(riffleGap(10)).toBeCloseTo(0.24)
  })

  it('brings the spine in with the first page, and takes it out on undo', () => {
    for (const mode of ['light', 'dark'] as const) {
      expect(spineShade(0, mode)).toBe(0)
      expect(spineShade(0.5, mode)).toBeGreaterThan(0)
      expect(spineShade(0.5, mode)).toBeLessThan(spineShade(1, mode))
      expect(spineShade(7, mode)).toBe(spineShade(1, mode))
    }
    expect(spineShade(1, 'dark')).toBe(1)
  })

  it.each(WORLDS.map((w) => w.id))("keeps the tile's ink at 4.5:1 across the spine's crease in light mode (%s)", (id) => {
    const palette = fillPalette(WORLD_COLORS[id].light, 'light')
    const opacity = fillOpacity('book', palette)
    const fill = mix(rgb(SURFACE.light), palette.mid, FILL_LOOK.book.body * opacity)
    // The crease's darkest line: gutterShade at the spine (0.42 + 0.25 in book.ts), at its full depth.
    const crease = mix(fill, [0, 0, 0], 0.67 * spineShade(10, 'light') * opacity)
    expect(contrastRatio(TILE_INK.light, toHex(crease))).toBeGreaterThanOrEqual(4.5)
  })

  it('turns the ten pages of "10 left", counting up as each passes the spine', () => {
    const book = createBook(fillPalette(WORLD_COLORS.forest.dark, 'dark'))
    book.setLevel(1, false)
    for (let i = 0; i < 60; i++) book.step(1 / 60, true)
    expect(book.shown()).toBeGreaterThan(0)
    expect(book.shown()).toBeLessThan(1)
    for (let i = 0; i < 60 * 5; i++) book.step(1 / 60, true)
    expect(book.shown()).toBe(1)
    expect(book.settled()).toBe(true)
    book.dispose()
  })

  it('lets the fill recede on undo, without turning pages back', () => {
    const book = createBook(fillPalette(WORLD_COLORS.forest.dark, 'dark'))
    book.setLevel(1, true)
    book.setLevel(0, false)
    expect(book.shown()).toBe(1)
    book.step(0.2, true)
    expect(book.shown()).toBeGreaterThan(0)
    expect(book.shown()).toBeLessThan(1)
    expect(book.settled()).toBe(false)
    for (let i = 0; i < 60; i++) book.step(1 / 60, true)
    expect(book.shown()).toBe(0)
    expect(book.settled()).toBe(true)
    book.dispose()
  })

  it('keeps the pages already turning when a sheet lowers the target, without jumping', () => {
    const book = createBook(fillPalette(WORLD_COLORS.forest.dark, 'dark'))
    book.setLevel(1, false)
    for (let i = 0; i < 60; i++) book.step(1 / 60, true)
    const s = book.shown()
    expect(s).toBeGreaterThan(0)
    expect(s).toBeLessThan(0.3)
    book.setLevel(0.3, false)
    expect(book.shown()).toBeLessThanOrEqual(s + 1e-9)
    for (let i = 0; i < 60 * 6; i++) book.step(1 / 60, true)
    expect(book.shown()).toBeCloseTo(0.3)
    expect(book.settled()).toBe(true)
    book.dispose()
  })
})

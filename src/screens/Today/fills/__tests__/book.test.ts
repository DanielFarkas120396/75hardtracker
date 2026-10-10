import { describe, expect, it } from 'vitest'
import { WORLD_COLORS } from '../../../../lib/worldColors'
import { createBook, riffleGap } from '../book'
import { fillPalette } from '../palette'

describe('book fill', () => {
  it('turns one page at the calm pace, and riffles several, all starting within 2.4 s', () => {
    expect(riffleGap(1)).toBeCloseTo(0.99)
    expect(riffleGap(10)).toBeCloseTo(0.24)
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

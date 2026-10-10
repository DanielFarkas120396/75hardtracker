import { describe, expect, it } from 'vitest'
import { WORLD_COLORS } from '../../../../lib/worldColors'
import { coverRepeat, createIris } from '../iris'
import { fillPalette } from '../palette'

describe('iris fill', () => {
  it('crops the photo to cover the tile', () => {
    expect(coverRepeat(2, 1)).toEqual([0.5, 1])
    expect(coverRepeat(0.75, 1.5)).toEqual([1, 0.5])
  })

  it('shuts, holds shut until the photo is there (1 s at most), then opens and settles', () => {
    const iris = createIris(fillPalette(WORLD_COLORS.forest.dark, 'dark'))
    iris.setLevel(1, false)
    for (let i = 0; i < 30; i++) iris.step(1 / 60, true)
    // Shut, no photo yet: still waiting.
    expect(iris.settled()).toBe(false)
    for (let i = 0; i < 60 * 2; i++) iris.step(1 / 60, true)
    expect(iris.settled()).toBe(true)
    expect(iris.shown()).toBe(1)
    iris.dispose()
  })

  it('opens after the hold when tapped again after an interrupted opening', () => {
    const iris = createIris(fillPalette(WORLD_COLORS.forest.dark, 'dark'))
    iris.setLevel(1, false)
    for (let i = 0; i < 80; i++) iris.step(1 / 60, true)
    iris.setLevel(0, false)
    iris.setImage?.({ width: 4, height: 3 } as ImageBitmap)
    iris.setLevel(1, false)
    for (let i = 0; i < 66; i++) iris.step(1 / 60, true)
    expect(iris.settled()).toBe(true)
    iris.dispose()
  })
})

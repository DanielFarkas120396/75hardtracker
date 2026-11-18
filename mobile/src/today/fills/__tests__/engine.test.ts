/** @jest-environment node */
import { fillPalette } from '@logic/fillPalette'
import { WORLD_COLORS } from '@logic/worldColors'
import { createFillEngine, type FillSurface } from '../engine'
import type { Uniforms } from '../shaders'

const DARK = fillPalette(WORLD_COLORS.forest.dark, 'dark')
const LIGHT = fillPalette(WORLD_COLORS.hell.light, 'light')

/** An engine whose frames the test pumps by hand, 60 a second. */
function harness() {
  let pending: ((now: number) => void) | null = null
  let now = 0
  const engine = createFillEngine({
    supports: () => true,
    palette: DARK,
    requestFrame: (frame) => {
      pending = frame
      return 1
    },
    cancelFrame: () => {
      pending = null
    },
    now: () => now,
  })
  return {
    engine,
    /** Runs up to `count` frames; returns how many ran before the loop stopped by itself. */
    frames(count: number) {
      let ran = 0
      while (ran < count && pending) {
        const frame: (now: number) => void = pending
        pending = null
        now += 1000 / 60
        frame(now)
        ran++
      }
      return ran
    },
    waiting: () => pending !== null,
  }
}

const surface = (): FillSurface => ({ uniforms: { value: {} as Uniforms }, previous: { value: {} as Uniforms }, fade: { value: 1 } })

describe('the fill engine', () => {
  it('draws a fill at the day’s level at once, and stops when nothing moves or drifts', () => {
    const { engine, frames } = harness()
    const tile = surface()
    const onFrame = jest.fn()
    const handle = engine.add('book', tile, onFrame)
    handle.setLevel(0.3, 'instant')
    // No size yet: nothing to draw.
    expect(frames(5)).toBe(1)
    expect(onFrame).not.toHaveBeenCalled()
    handle.setSize(173, 120)
    expect(frames(5)).toBe(1)
    expect(onFrame).toHaveBeenCalledTimes(1)
    expect(tile.uniforms.value.uSize).toEqual([173, 120])
    expect(handle.shown()).toBeCloseTo(0.3)
    expect(handle.settledAt()).toBe(0.3)
  })

  it('animates a change every frame, reports it settled, then draws the drift at 30 frames a second at most', () => {
    const { engine, frames, waiting } = harness()
    const tile = surface()
    const onFrame = jest.fn()
    const handle = engine.add('sprint', tile, onFrame)
    handle.setSize(173, 120)
    handle.setLevel(0, 'instant')
    frames(3)
    onFrame.mockClear()

    handle.setLevel(0.5, 'animate')
    expect(handle.settledAt()).toBeNull()
    frames(30)
    expect(onFrame).toHaveBeenCalledTimes(30)
    frames(60)
    expect(handle.settledAt()).toBe(0.5)
    // At rest with something in it: the flow keeps going, on fewer frames (30 a second at most).
    onFrame.mockClear()
    expect(frames(60)).toBe(60)
    expect(onFrame.mock.calls.length).toBeGreaterThanOrEqual(19)
    expect(onFrame.mock.calls.length).toBeLessThanOrEqual(31)
    expect(waiting()).toBe(true)
  })

  it('neither steps nor draws while held, and carries on from where it was', () => {
    const { engine, frames, waiting } = harness()
    const handle = engine.add('wave', surface(), () => undefined)
    handle.setSize(173, 120)
    handle.setLevel(0, 'instant')
    frames(2)
    handle.setLevel(1, 'animate')
    frames(10)
    const before = handle.shown()
    engine.hold(true)
    expect(waiting()).toBe(false)
    expect(frames(30)).toBe(0)
    expect(handle.shown()).toBe(before)
    engine.hold(false)
    frames(10)
    expect(handle.shown()).toBeGreaterThan(before)
  })

  it('crossfades to a new level under reduce motion, and is only settled once the fade is over', () => {
    const { engine, frames, waiting } = harness()
    const tile = surface()
    engine.setReduceMotion(true)
    const handle = engine.add('wave', tile, () => undefined)
    handle.setSize(173, 120)
    handle.setLevel(0.25, 'instant')
    frames(2)
    const first = tile.uniforms.value
    expect(tile.previous.value).toBe(first)

    handle.setLevel(0.5, 'fade')
    expect(handle.shown()).toBe(0.5)
    expect(handle.settledAt()).toBeNull()
    expect(tile.previous.value).toBe(first)
    expect(tile.fade.value).toBe(0)
    frames(6)
    expect(tile.fade.value).toBeGreaterThan(0)
    expect(tile.fade.value).toBeLessThan(1)
    frames(20)
    expect(tile.fade.value).toBe(1)
    expect(handle.settledAt()).toBe(0.5)
    // Nothing drifts under reduce motion: the loop has stopped.
    expect(waiting()).toBe(false)
  })

  it('recolours every fill with a new world or theme, without restarting it', () => {
    const { engine, frames } = harness()
    const tile = surface()
    const handle = engine.add('ink', tile, () => undefined)
    handle.setSize(173, 120)
    handle.setLevel(1, 'instant')
    frames(2)
    const dark = tile.uniforms.value.uTop
    engine.setPalette(LIGHT)
    frames(2)
    expect(tile.uniforms.value.uTop).not.toEqual(dark)
    expect(handle.settledAt()).toBe(1)
  })

  it('leaves a removed fill alone', () => {
    const { engine, frames, waiting } = harness()
    const onFrame = jest.fn()
    const handle = engine.add('sprint', surface(), onFrame)
    handle.setSize(173, 120)
    handle.setLevel(1, 'instant')
    frames(2)
    handle.remove()
    onFrame.mockClear()
    frames(5)
    expect(onFrame).not.toHaveBeenCalled()
    expect(waiting()).toBe(false)
  })
})

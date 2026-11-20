import type { FillModel } from './fillKinds'
import { clamp01, cubicOut, spring } from './fillMotion'

/** The chosen settings (docs/prototypes/README.md, Water). */
export const WAVE = { rise: 2.4, amp: 8.5, slosh: 0.69, bubbles: 0.82, shimmer: 0.28, back: 0.66 }

/** The surface's height, px from the tile's centre (y up), for a share of the goal: just under the tile when empty, past its top (waves and all) when full. */
export function waveSurfaceY(level: number, height: number): number {
  return -height / 2 - WAVE.amp - 3 + level * (height + 3 * WAVE.amp + 19)
}

export interface WaveFrame {
  /** The surface's height, px from the tile's centre (y up). */
  level: number
  time: number
  slosh: number
  /** The ripple's height, how long ago it started (s) and where (px from the tile's centre). */
  ripA: number
  ripT: number
  ripX: number
  fizz: number
  /** How much of the back wave shows. */
  back: number
}

/** Water: the level rises with a rolling surface; each pour sloshes, sends a ripple out from the "+ 250 ml" chip and stirs the bubbles. */
export function createWaveModel(): FillModel<WaveFrame> {
  const slosh = spring(25, 0.12)
  let from = 0
  let to = 0
  let t = 1
  let time = 0
  let ripT = 9
  let fizz = 0
  let ripRight = 40
  const shown = () => from + (to - from) * cubicOut(t)

  return {
    setLevel(level, instant) {
      const up = level > to
      from = instant ? level : shown()
      to = level
      t = instant ? 1 : 0
      if (instant) slosh.set(0, true)
      else if (up) {
        slosh.kick(-WAVE.slosh * 60)
        ripT = 0
        fizz = 1
      }
    },
    step(dt, drift) {
      t = Math.min(1, t + dt / WAVE.rise)
      if (drift) time += dt
      ripT += dt
      fizz *= Math.exp(-dt / 1.2)
      const sloshing = slosh.step(dt)
      return t < 1 || sloshing || ripT < 3
    },
    drifts: () => to > 0,
    shown,
    settled: () => Math.abs(to - shown()) < 0.005,
    setAnchor(right) {
      ripRight = right
    },
    frame(width, height) {
      const level = waveSurfaceY(shown(), height)
      return {
        level,
        time,
        slosh: slosh.y,
        ripA: WAVE.slosh * 5 * Math.exp(-ripT / 0.9),
        ripT,
        ripX: width / 2 - ripRight,
        fizz,
        // The back wave rides higher than the front one: it fades in over the first 12 px of rise so it never peeks out of an empty tile.
        back: WAVE.back * clamp01((level - waveSurfaceY(0, height)) / 12),
      }
    },
  }
}

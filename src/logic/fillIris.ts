import type { FillModel } from './fillKinds'
import { clamp01, cubicOut } from './fillMotion'

/** The chosen settings (docs/prototypes/README.md, Photo). */
export const IRIS = { blades: 8, close: 0.11, open: 0.9, twist: 0.55, flash: 0.7, colour: 0.3 }
/** Shut for a moment while the photo is set behind the blades; up to IRIS_WAIT if the photo isn't loaded yet. */
export const IRIS_HOLD = 0.06
export const IRIS_WAIT = 1

/** The share of the photo's texture to show so it covers the tile, cropped in the middle. */
export function coverRepeat(imageAspect: number, tileAspect: number): [number, number] {
  return imageAspect > tileAspect ? [tileAspect / imageAspect, 1] : [1, imageAspect / tileAspect]
}

export interface IrisFrame {
  /** The opening's inradius, px: past `rmax` the blades are out of the tile, below 0 they overlap. */
  r: number
  rmax: number
  /** How far each blade is turned from its open place, radians: the twist as it opens. */
  twist: number
  /** Whether the photo layer shows, 0 or 1. */
  photo: number
  flash: number
}

export interface IrisModel extends FillModel<IrisFrame> {
  /** Whether the day's photo is decoded: the iris stays shut until it is (IRIS_WAIT at most). */
  setHasImage(has: boolean): void
}

/** Photo: a camera iris shuts, a flash fires as it closes, and its blades swirl open on the day's photo in the world's colour. */
export function createIrisModel(): IrisModel {
  let on = false
  let t = -1
  let waited = 0
  let openFrom = 0
  let hasImage = false
  let photo = 0
  let flash = 0

  return {
    setLevel(level, instant) {
      const want = level >= 1
      if (want === on) return
      on = want
      openFrom = 0
      if (!on) {
        t = -1
        photo = 0
        flash = 0
        return
      }
      if (instant) {
        t = -1
        photo = 1
      } else {
        t = 0
        waited = 0
      }
    },
    // The tap snaps the iris shut (ease in), a flash fires as it closes, the photo is set behind it, then it swirls open (ease out).
    step(dt) {
      if (t < 0) return false
      t += dt
      if (t >= IRIS.close + IRIS_HOLD && openFrom === 0 && (hasImage || waited >= IRIS_WAIT)) openFrom = t
      if (t >= IRIS.close + IRIS_HOLD && openFrom === 0) waited += dt
      if (t >= IRIS.close) photo = 1
      flash = t < IRIS.close ? 0 : IRIS.flash * Math.exp(-(t - IRIS.close) / 0.12)
      if (openFrom > 0 && t > openFrom + IRIS.open + 0.3) {
        t = -1
        openFrom = 0
        flash = 0
        return false
      }
      return true
    },
    drifts: () => false,
    shown: () => (on && (t < 0 || t >= IRIS.close) ? 1 : 0),
    settled: () => !on || t < 0 || (openFrom > 0 && t >= openFrom + IRIS.open * 0.85),
    setHasImage(has) {
      hasImage = has
    },
    frame(width, height) {
      const rmax = Math.hypot(width / 2, height / 2) + 12
      let r = rmax
      if (t >= 0) {
        if (t < IRIS.close) r = rmax - (rmax + 6) * (t / IRIS.close) ** 2
        else if (openFrom === 0) r = -6
        else r = -6 + (rmax + 6) * cubicOut((t - openFrom) / IRIS.open)
      }
      return { r, rmax, twist: IRIS.twist * 1.4 * (1 - clamp01(r / rmax)), photo, flash }
    },
  }
}

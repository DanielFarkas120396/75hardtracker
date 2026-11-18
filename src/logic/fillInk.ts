import type { FillModel } from './fillKinds'
import { outQuart } from './fillMotion'

/** The chosen settings (docs/prototypes/README.md, Diet). */
export const INK = { spread: 1.1, swirl: 0.81, grain: 150, soft: 20, drift: 0.36 }
/** How far past its radius the ink's swirl and soft edge reach. */
export const INK_MARGIN = INK.swirl * 40 + INK.soft + 6

/** The radius from `origin` (px from the tile's centre, y up) that covers `level` of the tile: read off the sorted distances to a grid of points, plus `margin` for the swirl and the soft edge. */
export function inkRadius(level: number, width: number, height: number, origin: readonly [number, number], margin: number): number {
  const distances: number[] = []
  for (let y = 0; y < 30; y++) {
    for (let x = 0; x < 60; x++) distances.push(Math.hypot(-width / 2 + ((x + 0.5) * width) / 60 - origin[0], -height / 2 + ((y + 0.5) * height) / 30 - origin[1]))
  }
  distances.sort((a, b) => a - b)
  if (level <= 0) return -margin
  if (level >= 1) return distances[distances.length - 1] + margin
  return distances[Math.floor(level * distances.length)]
}

export interface InkFrame {
  time: number
  /** The edge's radius from the origin, px. */
  radius: number
  /** Where the ink starts, px from the tile's centre (y up). */
  origin: [number, number]
}

/** Diet: ink blooming through water from the switches, half the tile per switch; it keeps drifting slowly. */
export function createInkModel(): FillModel<InkFrame> {
  let time = Math.random() * 50
  let from = 0
  let to = 0
  let p = 1
  // A spread eases from the radius last drawn, not from its level's: the radius isn't linear in the level, so a tap mid-spread would snap the edge.
  let fromR: number | null = null
  let drawnR: number | null = null
  let anchorRight = 56
  let anchorTop = 60
  const shown = () => from + (to - from) * outQuart(p)

  return {
    setLevel(level, instant) {
      from = instant ? level : shown()
      to = level
      p = instant ? 1 : 0
      if (instant) drawnR = null
      fromR = drawnR
    },
    step(dt, drift) {
      p = Math.min(1, p + dt / INK.spread)
      if (drift) time += dt * INK.drift
      return p < 1
    },
    drifts: () => to > 0,
    shown,
    settled: () => p >= 0.85,
    setAnchor(right, top) {
      anchorRight = right
      anchorTop = top
    },
    frame(width, height) {
      const origin: [number, number] = [width / 2 - anchorRight, height / 2 - anchorTop]
      const b = inkRadius(to, width, height, origin, INK_MARGIN)
      fromR ??= inkRadius(from, width, height, origin, INK_MARGIN)
      drawnR = fromR + (b - fromR) * outQuart(p)
      return { time, radius: drawnR, origin }
    },
  }
}

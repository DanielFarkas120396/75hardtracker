import type { FillModel } from './fillKinds'
import { clamp01, cubicOut } from './fillMotion'

/** The chosen settings (docs/prototypes/README.md, Workouts). */
export const SPRINT = { run: 0.7, lanes: 12, streak: 90, ragged: 16, flow: 0.3 }

/** The fill's front, px from the tile's left edge: off the left when empty, off the right (ragged edge and all) when full. */
export function sprintFront(level: number, width: number): number {
  const edge = SPRINT.ragged + 10
  return -edge + level * (width + 2 * edge)
}

export interface SprintFrame {
  /** The front, px from the tile's left edge. */
  front: number
  /** The front's speed against its top speed, 0–1: how far the streaks reach. */
  vel: number
  time: number
}

/** Workouts: the fill races in from the left with speed lines in lanes, which pull back into it as it stops; thin lines keep flowing through it. */
export function createSprintModel(): FillModel<SprintFrame> {
  let from = 0
  let to = 0
  let t = 1
  let time = 0
  let prev = 0
  let vel = 0
  // Off at full speed on the tap (ease out): the streaks are longest at once and pull in as it stops.
  const shown = () => from + (to - from) * cubicOut(t)

  return {
    setLevel(level, instant) {
      from = instant ? level : shown()
      to = level
      t = instant ? 1 : 0
      if (instant) vel = 0
      prev = shown()
    },
    step(dt, drift) {
      t = Math.min(1, t + dt / SPRINT.run)
      if (drift) time += dt
      const now = shown()
      // How fast the front moves, against its top speed, sets how far the streaks reach.
      const v = dt > 0 ? Math.abs(now - prev) / dt / ((Math.abs(to - from) / SPRINT.run) * 1.5 + 1e-3) : 0
      prev = now
      vel += (clamp01(v) - vel) * Math.min(1, dt * 12)
      return t < 1 || vel > 0.01
    },
    drifts: () => to > 0,
    shown,
    settled: () => t >= 0.8,
    frame: (width) => ({ front: sprintFront(shown(), width), vel, time }),
  }
}

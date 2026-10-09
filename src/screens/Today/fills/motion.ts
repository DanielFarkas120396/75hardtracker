export const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
export const smooth = (x: number) => {
  const t = clamp01(x)
  return t * t * (3 - 2 * t)
}
export const cubicOut = (x: number) => 1 - (1 - clamp01(x)) ** 3
export const outQuart = (x: number) => 1 - (1 - clamp01(x)) ** 4
export const inOut = (x: number) => {
  const t = clamp01(x)
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

export interface Spring {
  readonly y: number
  set(target: number, instant: boolean): void
  kick(velocity: number): void
  /** Advances by `dt` seconds; true while it still moves. */
  step(dt: number): boolean
}

/** A damped spring: `k` sets how fast it moves, `z` how little it overshoots (1 = not at all). */
export function spring(k: number, z: number): Spring {
  let y = 0
  let v = 0
  let to = 0
  return {
    get y() {
      return y
    },
    set(target, instant) {
      to = target
      if (instant) {
        y = target
        v = 0
      }
    },
    kick(velocity) {
      v += velocity
    },
    step(dt) {
      v += (k * (to - y) - 2 * z * Math.sqrt(k) * v) * dt
      y += v * dt
      const moving = Math.abs(to - y) > 0.05 || Math.abs(v) > 0.3
      if (!moving) {
        y = to
        v = 0
      }
      return moving
    },
  }
}

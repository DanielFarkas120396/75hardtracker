/**
 * The duck's motion model. It is pure TypeScript (no DOM, no React), so every
 * behaviour is unit-testable. Mascot.tsx creates one rig per duck, feeds it
 * the elapsed time and events, and writes the pose it returns into the SVG.
 *
 * Angles are in degrees in SVG space (negative raises the arm or the knife).
 * Lengths are the art's SVG units (viewBox -10 20 490 500).
 *
 * The knife never moves on its own: the left wing carries it, and the wrist
 * only rotates it about the grip. The single exception is the celebration
 * toss, where the arm throws it and catches it again.
 */

export type DuckMood =
  | 'content'
  | 'watching'
  | 'tapping'
  | 'hunting'
  | 'celebrating'
  | 'triumphant'
  | 'judging'
  | 'waiting'
  | 'sad'

export type DuckReaction = 'poke' | 'lunge' | 'approve' | 'glare' | 'relax'

export interface MoodPose {
  arm: number
  knife: number
  lean: number
  /** Brow visibility, 0–1. */
  brow: number
  /** Brow slope: 0 flat (suspicious) to 1 furious. */
  anger: number
  /** Eye height: 1 is fully open. */
  squint: number
  /** Crossfade to the ^ ^ happy eyes, 0–1. */
  happy: number
  sweat: number
  /** Seconds per tap cycle; 0 means no tapping. */
  tapPeriod: number
  /** Whether each tap strike makes the blade glint. */
  strikeGlint: boolean
  tremble: boolean
  bob: boolean
  wave: boolean
  toss: boolean
  /** Mean seconds between blade glints; 0 means only strikes glint. */
  glintEvery: number
  /** Stares at you instead of glancing around, and blinks slowly. */
  stare: boolean
  /** A fixed gaze instead of glances, e.g. looking down when sad. */
  gaze?: readonly [number, number]
}

const CALM = { strikeGlint: false, tremble: false, bob: false, wave: false, toss: false, stare: false, sweat: 0 }

export const MOOD_POSES: Record<DuckMood, MoodPose> = {
  content: { ...CALM, arm: 5, knife: 28, lean: 1, brow: 0, anger: 0, squint: 1, happy: 1, tapPeriod: 0, bob: true, wave: true, glintEvery: 0 },
  watching: { ...CALM, arm: 0, knife: 0, lean: 1, brow: 0, anger: 0, squint: 1, happy: 0, tapPeriod: 0, glintEvery: 4.2 },
  tapping: { ...CALM, arm: -15, knife: 15, lean: 1.03, brow: 1, anger: 0.15, squint: 0.9, happy: 0, tapPeriod: 1, strikeGlint: true, glintEvery: 0 },
  hunting: { ...CALM, arm: -26, knife: 26, lean: 1.08, brow: 1, anger: 1, squint: 0.72, happy: 0, tapPeriod: 0, tremble: true, glintEvery: 1.1, stare: true },
  celebrating: { ...CALM, arm: -10, knife: 10, lean: 1, brow: 0, anger: 0, squint: 1, happy: 1, tapPeriod: 0, bob: true, wave: true, toss: true, glintEvery: 0 },
  triumphant: { ...CALM, arm: -70, knife: 0, lean: 1.02, brow: 0, anger: 0, squint: 1, happy: 1, tapPeriod: 0, bob: true, wave: true, glintEvery: 2 },
  judging: { ...CALM, arm: -15, knife: 15, lean: 1.02, brow: 1, anger: 0.6, squint: 0.8, happy: 0, tapPeriod: 1.6, strikeGlint: true, glintEvery: 0, stare: true },
  waiting: { ...CALM, arm: -15, knife: 15, lean: 1, brow: 0, anger: 0, squint: 1, happy: 0, tapPeriod: 1.6, glintEvery: 0 },
  sad: { ...CALM, arm: 8, knife: 35, lean: 0.98, brow: 0, anger: 0, squint: 0.85, happy: 0, sweat: 1, tapPeriod: 0, glintEvery: 0, gaze: [0, 5] },
}

const smooth = (u: number) => u * u * (3 - 2 * u)

/** The tap cycle's arm angle at `phase` (0–1): a slow lift to −12°, a quick strike to +3°, then a settle to 0. */
export function tapAngle(phase: number): number {
  if (phase < 0.72) {
    const u = phase / 0.72
    return -12 * smooth(u)
  }
  if (phase < 0.8) {
    const u = (phase - 0.72) / 0.08
    return -12 + 15 * u * u
  }
  const u = (phase - 0.8) / 0.2
  return 3 * (1 - smooth(u))
}

/** Seconds per knife toss while celebrating. */
export const TOSS_PERIOD = 2.4
const RELEASE = 0.4
const CATCH = 1.1
const SETTLED = 1.6
const TOSS_HEIGHT = 180

/**
 * The toss `seconds` into its cycle: the extra arm angle, the knife's spin,
 * and how high the knife is above the hand, in world space. The arm winds down,
 * flicks up and releases at its peak. The knife flies a parabola, spinning
 * once, and the raised hand catches it and lowers.
 */
export function tossAt(seconds: number): { arm: number; spin: number; lift: number } {
  if (seconds < 0.25) return { arm: 12 * smooth(seconds / 0.25), spin: 0, lift: 0 }
  if (seconds < RELEASE) {
    const u = (seconds - 0.25) / (RELEASE - 0.25)
    return { arm: 12 - 57 * (1 - (1 - u) * (1 - u)), spin: 0, lift: 0 }
  }
  if (seconds < CATCH) {
    const u = (seconds - RELEASE) / (CATCH - RELEASE)
    return { arm: -45, spin: 360 * u, lift: TOSS_HEIGHT * 4 * u * (1 - u) }
  }
  if (seconds < SETTLED) return { arm: -45 * (1 - smooth((seconds - CATCH) / (SETTLED - CATCH))), spin: 0, lift: 0 }
  return { arm: 0, spin: 0, lift: 0 }
}

/** Everything Mascot.tsx needs to draw one frame. */
export interface RigPose {
  shake: number
  hop: number
  sway: number
  scaleX: number
  scaleY: number
  breathe: number
  /** Left-wing rotation about the shoulder. */
  arm: number
  /** Knife rotation about the grip. */
  knife: number
  /** Knife translation in the wing's space: [0, 0] unless it's in the air. */
  knifeOffset: [number, number]
  rightWing: number
  gazeX: number
  gazeY: number
  eyeScaleY: number
  eyesOpacity: number
  happyOpacity: number
  happyLift: number
  browsOpacity: number
  browFlat: number
  browsDx: number
  browsDy: number
  glintX: number
  sweatOpacity: number
}

export interface DuckTransforms {
  whole: string
  body: string
  leftWing: string
  knife: string
  rightWing: string
  eyeL: string
  eyeR: string
  happy: string
  brows: string
  browL: string
  browR: string
  glint: string
}

export interface Rig {
  readonly mood: DuckMood
  setMood(mood: DuckMood): void
  setReducedMotion(reduced: boolean): void
  react(kind: DuckReaction): void
  /** A finger touched or dragged at this point, in the art's SVG units. */
  touch(point: { x: number; y: number }): void
  /** The page scrolled: glance down at the list. */
  scrolled(): void
  /** Advances `dt` seconds and returns the pose to draw. */
  step(dt: number): RigPose
}

interface Spring {
  x: number
  v: number
  to: number
  k: number
  c: number
}

const spring = (x: number, k: number, c: number): Spring => ({ x, v: 0, to: x, k, c })

/** Time-based, so it's frame-rate independent; substeps keep the stiff springs stable. */
function stepSpring(s: Spring, dt: number): void {
  const steps = Math.max(1, Math.ceil(dt / 0.004))
  const h = dt / steps
  for (let i = 0; i < steps; i++) {
    s.v += (-s.k * (s.x - s.to) - s.c * s.v) * h
    s.x += s.v * h
  }
}

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1)
const TAU = Math.PI * 2
const EYES_CENTRE = { x: 235, y: 175 }
const GLANCES: readonly (readonly [number, number])[] = [
  [0, 3],
  [5, 9],
  [-9, 1],
  [8, -1],
]
const STARE: readonly [number, number] = [0, 2]
const TOUCH_HOLD = 1.3
const SCROLL_HOLD = 1
const GLINT_DURATION = 0.52
const LUNGE_WIND_UP = 0.32
const GLARE_DURATION = 1.5
const RELAX_DURATION = 1.5
const MAX_DT = 0.05

export function createRig(options: { mood: DuckMood; reducedMotion?: boolean; random?: () => number }): Rig {
  const random = options.random ?? Math.random
  let mood = options.mood
  let reduced = options.reducedMotion ?? false
  let t = 0
  const start = MOOD_POSES[mood]
  const S = {
    arm: spring(start.arm, 140, 18),
    knife: spring(start.knife, 160, 20),
    lean: spring(start.lean, 120, 20),
    brow: spring(start.brow, 200, 26),
    anger: spring(start.anger, 200, 26),
    squint: spring(start.squint, 220, 28),
    happy: spring(start.happy, 180, 24),
    sweat: spring(start.sweat, 120, 20),
    gx: spring(0, 520, 42),
    gy: spring(0, 520, 42),
    squash: spring(1, 380, 16),
    nod: spring(0, 300, 18),
    tap: spring(0, 60, 16),
    tremble: spring(0, 60, 16),
    bob: spring(0, 60, 16),
    wave: spring(0, 60, 16),
    toss: spring(0, 60, 16),
    shake: spring(0, 60, 14),
  }
  let blinkAt = -1
  let blinkDuration = 0.15
  let nextBlink = 0.9
  let glintAt = -1
  let nextGlint = 1.6
  let holdGazeUntil = 0
  let nextGlance = 0
  let lungeAt = -1
  let glareUntil = -1
  let relaxUntil = -1
  // The tap keeps its own phase and the toss its own clock (0–1 and seconds),
  // so a mood change turns them continuously instead of snapping to a new
  // formula. `lastTapPeriod` is the rate to keep using while the current
  // mood doesn't tap, so the phase keeps advancing smoothly through a
  // crossfade instead of freezing.
  let tapPhase = 0
  let lastTapPeriod = start.tapPeriod > 0 ? start.tapPeriod : 1
  let lastTapPhase = 0
  let tossClock = 0
  let lastTossSeconds = 0

  function setTargets(tossActive: boolean): void {
    const p = MOOD_POSES[mood]
    const lunging = lungeAt >= 0
    const glaring = t < glareUntil
    const relaxing = t < relaxUntil
    S.arm.to = lunging ? -70 : relaxing ? 10 : p.arm
    S.knife.to = lunging ? 0 : relaxing ? 30 : p.knife
    S.lean.to = lunging ? 1.32 : p.lean
    S.brow.to = lunging || glaring ? 1 : p.brow
    S.anger.to = lunging || glaring ? 1 : p.anger
    S.squint.to = glaring ? Math.min(p.squint, 0.7) : p.squint
    S.happy.to = lunging || glaring ? 0 : p.happy
    S.sweat.to = p.sweat
    const motion = reduced ? 0 : 1
    S.tap.to = p.tapPeriod > 0 ? motion : 0
    S.tremble.to = p.tremble ? motion : 0
    S.bob.to = p.bob ? motion : 0
    S.wave.to = p.wave ? motion : 0
    S.toss.to = tossActive ? motion : 0
    S.shake.to = 0
    S.squash.to = 1
    S.nod.to = 0
  }

  return {
    get mood() {
      return mood
    },

    setMood(next) {
      mood = next
      nextGlance = t
      nextGlint = t + 0.6
    },

    setReducedMotion(next) {
      reduced = next
      if (reduced) {
        // Return every clock and timer to a fresh rig's values, so the still
        // pose never depends on history, and turning motion back on resumes
        // blinking, glancing and glinting right away instead of picking up
        // stale timers from a clock that's been frozen for a while.
        t = 0
        blinkAt = -1
        nextBlink = 0.9
        glintAt = -1
        nextGlint = 1.6
        holdGazeUntil = 0
        nextGlance = 0
        lungeAt = -1
        glareUntil = -1
        relaxUntil = -1
        tapPhase = 0
        tossClock = 0
      }
    },

    react(kind) {
      if (reduced) return
      switch (kind) {
        case 'poke':
          S.squash.v -= 5
          S.arm.v -= 420
          S.knife.v -= 260
          S.brow.v += 12
          S.anger.v += 12
          break
        case 'lunge':
          lungeAt = t
          break
        case 'approve':
          S.nod.v += 120
          S.squash.v -= 2
          break
        case 'glare':
          glareUntil = t + GLARE_DURATION
          break
        case 'relax':
          relaxUntil = t + RELAX_DURATION
          break
      }
    },

    touch({ x, y }) {
      if (reduced) return
      const dx = x - EYES_CENTRE.x
      const dy = y - EYES_CENTRE.y
      const distance = Math.hypot(dx, dy) || 1
      const reach = Math.min(distance / 200, 1) * 10
      S.gx.to = (dx / distance) * reach
      S.gy.to = (dy / distance) * reach * 0.8
      holdGazeUntil = t + TOUCH_HOLD
    },

    scrolled() {
      if (reduced) return
      S.gx.to = 4
      S.gy.to = 9
      holdGazeUntil = t + SCROLL_HOLD
    },

    step(dtIn) {
      const dt = Math.min(Math.max(dtIn, 0), MAX_DT)
      if (!reduced) t += dt
      const p = MOOD_POSES[mood]

      // The lunge winds the knife up overhead, then stabs back down.
      if (lungeAt >= 0 && t - lungeAt >= LUNGE_WIND_UP) {
        lungeAt = -1
        S.arm.v += 900
        S.shake.x = 1
        S.shake.v = 0
      }
      // A toss already in flight (wound up, in the air or being caught) keeps
      // running, and keeps the toss gate open, even after the mood stops
      // tossing: the knife is always caught, never dropped mid-air.
      const tossActive = p.toss || (tossClock > 0 && tossClock < SETTLED)
      setTargets(tossActive)

      if (p.gaze) {
        S.gx.to = p.gaze[0]
        S.gy.to = p.gaze[1]
      } else if (reduced) {
        // No history-dependent stare: a still pose always centres the gaze
        // unless the mood fixes it.
        S.gx.to = 0
        S.gy.to = 0
      } else if (t >= holdGazeUntil && t >= nextGlance) {
        const glance = p.stare ? STARE : GLANCES[Math.floor(random() * GLANCES.length)]
        S.gx.to = glance[0]
        S.gy.to = glance[1]
        nextGlance = t + (p.stare ? 3.5 : 1.8 + random() * 2.6)
      }

      let blink = 1
      if (!reduced) {
        if (blinkAt < 0 && t >= nextBlink) {
          blinkAt = t
          // Fixed for the whole blink, so a mood change mid-blink can't
          // change its speed.
          blinkDuration = p.stare ? 0.46 : 0.15
        }
        if (blinkAt >= 0) {
          const elapsed = t - blinkAt
          if (elapsed >= blinkDuration) {
            blinkAt = -1
            nextBlink = t + (p.stare ? 4.5 : 1.6) + random() * 3.2
          } else {
            blink = 1 - 0.92 * Math.sin((elapsed / blinkDuration) * Math.PI)
          }
        }
      }

      // The phase itself never jumps: it's carried state, advanced at the
      // current mood's rate (or the last tapping mood's, while fading out).
      const tapPeriod = p.tapPeriod > 0 ? p.tapPeriod : lastTapPeriod
      lastTapPeriod = tapPeriod
      if (!reduced) tapPhase = (tapPhase + dt / tapPeriod) % 1
      const tapA = tapAngle(tapPhase)
      if (!reduced && p.tapPeriod > 0 && S.tap.x > 0.5 && lastTapPhase < 0.8 && tapPhase >= 0.8) {
        S.squash.v -= 1.4
        if (p.strikeGlint && glintAt < 0) glintAt = t
      }
      lastTapPhase = tapPhase

      // The clock keeps running (see tossActive above) until a toss already
      // under way is finished, so it's always caught rather than dropped.
      if (!reduced && tossActive) tossClock = (tossClock + dt) % TOSS_PERIOD
      const toss = tossAt(tossClock)
      if (!reduced && lastTossSeconds < CATCH && tossClock >= CATCH) S.squash.v -= 1.5
      lastTossSeconds = tossClock

      if (!reduced && p.glintEvery > 0 && glintAt < 0 && t >= nextGlint) glintAt = t
      let glintX = -80
      if (glintAt >= 0) {
        const g = (t - glintAt) / GLINT_DURATION
        if (g >= 1) {
          glintAt = -1
          nextGlint = t + p.glintEvery * (0.75 + random() * 0.5)
        } else {
          const eased = g < 0.5 ? 2 * g * g : 1 - Math.pow(-2 * g + 2, 2) / 2
          glintX = -60 + eased * 330
        }
      }

      for (const s of Object.values(S)) {
        if (reduced) {
          s.x = s.to
          s.v = 0
        } else {
          stepSpring(s, dt)
        }
      }

      const arm =
        S.arm.x + 1.1 * S.tremble.x * Math.sin((TAU * t) / 0.09) + tapA * S.tap.x + toss.arm * S.toss.x
      // The knife's lift is straight up in world space; the knife lives in the
      // rotated wing, so turn that vector back by the arm's angle.
      const lift = toss.lift * S.toss.x
      const radians = (arm * Math.PI) / 180
      const knifeOffset: [number, number] = lift === 0 ? [0, 0] : [-lift * Math.sin(radians), -lift * Math.cos(radians)]
      const happy = clamp01(S.happy.x)
      const brow = clamp01(S.brow.x)

      return {
        shake: 9 * S.shake.x * Math.sin((TAU * t) / 0.07),
        hop: -9 * S.bob.x * Math.pow(Math.sin((TAU * t) / 1.8), 2),
        sway: 1.8 * Math.sin((TAU * t) / 4.2) + S.nod.x,
        scaleX: S.lean.x * (2 - S.squash.x),
        scaleY: S.lean.x * S.squash.x,
        breathe: 1 + 0.012 * Math.sin((TAU * t) / 2.6),
        arm,
        knife: S.knife.x + tapA * 0.5 * S.tap.x + toss.spin * S.toss.x,
        knifeOffset,
        rightWing: 6 * S.wave.x * Math.sin((TAU * t) / 0.7),
        gazeX: S.gx.x,
        gazeY: S.gy.x,
        eyeScaleY: Math.max(0.02, (1 - happy) * blink * S.squint.x),
        eyesOpacity: 1 - happy,
        happyOpacity: happy,
        happyLift: (1 - happy) * 8,
        browsOpacity: Math.min(1, brow * 1.6),
        browFlat: 12 * (1 - Math.min(Math.max(S.anger.x, 0), 1.2)),
        browsDx: S.gx.x * 0.4,
        browsDy: S.gy.x * 0.4 + 10 * (1 - brow) + 7 * (1 - S.squint.x),
        glintX,
        sweatOpacity: clamp01(S.sweat.x),
      }
    },
  }
}

const n = (value: number) => Number(value.toFixed(3))

/** The pose as SVG `transform` values, with pivots from duck-rig.svg. */
export function poseToTransforms(pose: RigPose): DuckTransforms {
  const eye = (cx: number, cy: number) =>
    `translate(${n(pose.gazeX)} ${n(pose.gazeY)}) translate(${cx} ${cy}) scale(1 ${n(pose.eyeScaleY)}) translate(${-cx} ${-cy})`
  return {
    whole: `translate(${n(pose.shake)} ${n(pose.hop)}) rotate(${n(pose.sway)} 234 500) translate(234 500) scale(${n(pose.scaleX)} ${n(pose.scaleY)}) translate(-234 -500)`,
    body: `translate(234 490) scale(1 ${n(pose.breathe)}) translate(-234 -490)`,
    leftWing: `rotate(${n(pose.arm)} 51 195)`,
    knife: `translate(${n(pose.knifeOffset[0])} ${n(pose.knifeOffset[1])}) rotate(${n(pose.knife)} 100 332)`,
    rightWing: `rotate(${n(pose.rightWing)} 405 225)`,
    eyeL: eye(155.5, 177.4),
    eyeR: eye(314.8, 170.6),
    happy: `translate(0 ${n(pose.happyLift)})`,
    brows: `translate(${n(pose.browsDx)} ${n(pose.browsDy)})`,
    browL: `rotate(${n(-pose.browFlat)} 154 154.5)`,
    browR: `rotate(${n(pose.browFlat)} 316.5 148)`,
    glint: `translate(${n(pose.glintX + 100)} 0)`,
  }
}

export const LUNGE_POKES = 3
export const LUNGE_WINDOW_MS = 1800

/** Adds a poke at `now` (ms): the third within 1.8 s is a lunge, and starts the count over. */
export function registerPoke(recent: readonly number[], now: number): { kind: 'poke' | 'lunge'; recent: number[] } {
  const inWindow = [...recent.filter((at) => now - at < LUNGE_WINDOW_MS), now]
  return inWindow.length >= LUNGE_POKES ? { kind: 'lunge', recent: [] } : { kind: 'poke', recent: inWindow }
}

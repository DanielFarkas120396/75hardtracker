// The gauge's one timeline per change, as a function of time: the web's GaugeRing effect
// (src/components/ui/GaugeRing.tsx), where the browser's animations and transitions run it.

export const BARS = 41
/** The wave and the fill cross their bars in this time, however many there are. */
const FRONT_MS = 700
const NUMBER_PULSE_MS = 600
const COLOUR_MS = 600
const UNLIT_OPACITY = 0.25

const REST = { dash: 18, offset: -6, width: 3 }
const PEAK = {
  up: { dash: 26, offset: -3, width: 4.1 },
  won: { dash: 30, offset: -2, width: 4.6 },
  down: { dash: 21.5, offset: -4.5, width: 3.5 },
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
/** The web's cubic-bezier(.37, 0, .63, 1): a sine in and out. */
const sine = (k: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp01(k))
/** The web's cubic-bezier(.22, 1, .36, 1). */
const outQuint = (k: number) => 1 - (1 - clamp01(k)) ** 5
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
/** A keyframe animation with one peak at `at`, eased as a whole. */
const peakAt = (k: number, at: number) => {
  const q = sine(k)
  return q < at ? q / at : 1 - (q - at) / (1 - at)
}
const hash = (n: number) => {
  const x = Math.sin(n * 127.1) * 43758.5453
  return x - Math.floor(x)
}

export const litBars = (value: number, max: number) => (max > 0 ? Math.round(clamp01(value / max) * BARS) : 0)
/** Never full before the day is won: only 5/5 earns the whole crown. */
export const crownFill = (p: number) => (p >= 1 ? 1 : p * 0.7)

export interface GaugeBar {
  /** The dash that shows of the bar, where it starts along it, and the bar's width. */
  dash: number
  offset: number
  width: number
  /** 0 unlit (grey), 1 lit in its colour. */
  lit: number
  opacity: number
}

export interface GaugeStar {
  x: number
  y: number
  size: number
  scale: number
  rotate: number
  opacity: number
  gold: boolean
}

export interface GaugeFrame {
  /** The number shown. */
  count: number
  /** How much of the label and the crown is filled, 0 to 1. */
  p: number
  crown: number
  /** Where the white glow is along the label (0 to 1), and how strong; null at rest. */
  sweep: number | null
  sweepStrength: number
  bars: GaugeBar[]
  number: { scale: number; dy: number; opacity: number }
  crownScale: number
  labelScale: number
  stars: GaugeStar[]
  /** Nothing moves any more. */
  done: boolean
}

/** A change under way: what the gauge showed when it began, and where it goes. */
export interface GaugeChange {
  from: number
  to: number
  max: number
  fromP: number
  fromCrown: number
  /** How lit each bar was. */
  fromLit: number[]
}

/** The gauge standing still on a value. */
export function restFrame(value: number, max: number): GaugeFrame {
  const p = max > 0 ? clamp01(value / max) : 0
  const lit = litBars(value, max)
  return {
    count: value,
    p,
    crown: crownFill(p),
    sweep: null,
    sweepStrength: 0,
    bars: Array.from({ length: BARS }, (_, i) => ({ ...REST, lit: i < lit ? 1 : 0, opacity: i < lit ? 1 : UNLIT_OPACITY })),
    number: { scale: 1, dy: 0, opacity: 1 },
    crownScale: 1,
    labelScale: 1,
    stars: [],
    done: true,
  }
}

/** A change from what `shown` shows to `to`. */
export function changeFrom(shown: GaugeFrame, to: number, max: number): GaugeChange {
  return { from: shown.count, to, max, fromP: shown.p, fromCrown: shown.crown, fromLit: shown.bars.map((bar) => bar.lit) }
}

/**
 * The gauge `ms` into a change. One front lights or dims the bars and a wave rides along it; short of 5/5 the grey
 * bars ahead absorb the wave; the number ticks once per task; the label and the crown fill with the front while a
 * white glow sweeps through the label; 5/5 ends with the crown filling up, popping, and twelve stars.
 */
export function gaugeFrame(change: GaugeChange, ms: number): GaugeFrame {
  const { from, to, max } = change
  const up = to > from
  const won = up && to >= max && max > 0
  const lit = litBars(to, max)
  const wasLit = litBars(from, max)
  const top = Math.max(lit, wasLit)
  const toP = max > 0 ? clamp01(to / max) : 0
  const toCrown = crownFill(Math.min(toP, 0.999))
  const waveMs = won ? 1100 : up ? 950 : 850
  const step = top > 1 ? FRONT_MS / (top - 1) : 0
  const peak = won ? PEAK.won : up ? PEAK.up : PEAK.down
  let end = FRONT_MS + NUMBER_PULSE_MS

  const bars: GaugeBar[] = Array.from({ length: BARS }, (_, i) => {
    const delay = (up ? i : top - 1 - i) * step
    // The colour changes as the wave reaches the bar, through its own short transition.
    const target = i < lit ? 1 : 0
    const turned = change.fromLit[i] === target ? 1 : sine((ms - delay - waveMs * 0.15) / COLOUR_MS)
    const bar: GaugeBar = { ...REST, lit: lerp(change.fromLit[i], target, turned), opacity: 0 }
    if (i < top) {
      end = Math.max(end, delay + waveMs, delay + waveMs * 0.15 + COLOUR_MS)
      const k = (ms - delay) / waveMs
      if (k > 0 && k < 1) {
        const swell = peakAt(k, 0.5)
        bar.dash = lerp(REST.dash, peak.dash, swell)
        bar.offset = lerp(REST.offset, peak.offset, swell)
        bar.width = lerp(REST.width, peak.width, swell)
      }
    }
    bar.opacity = lerp(UNLIT_OPACITY, 1, bar.lit)
    return bar
  })

  // Short of 5/5, the grey bars ahead absorb the wave, more and more softly, to the end of the arch.
  if (up && !won && lit > 0) {
    const tail = BARS - lit
    const pace = step || FRONT_MS / BARS
    for (let j = 0; j < tail; j++) {
      const a = (1 - (j + 1) / (tail + 1)) ** 1.4
      const duration = waveMs * (1 - (0.25 * (j + 1)) / tail)
      const delay = (lit - 1) * pace + (j + 1) * pace * (1 + (0.6 * j) / tail)
      end = Math.max(end, delay + duration)
      const k = (ms - delay) / duration
      if (k <= 0 || k >= 1) continue
      const swell = peakAt(k, 0.5) * a
      const bar = bars[lit + j]
      bar.dash = REST.dash + 3.5 * swell
      bar.offset = REST.offset + 1.2 * swell
      bar.width = REST.width + 0.8 * swell
      bar.opacity += 0.2 * swell
    }
  }

  // The number: one tick per task, with the wave.
  const steps = Math.abs(to - from)
  const gap = steps > 1 ? Math.min(NUMBER_PULSE_MS * 0.75, FRONT_MS / (steps - 1)) : 0
  const ticked = steps === 0 ? 0 : Math.min(steps, Math.floor(gap > 0 ? ms / gap : 0) + 1)
  const sinceTick = ms - (ticked - 1) * gap
  const beat = steps > 0 && sinceTick < NUMBER_PULSE_MS ? peakAt(sinceTick / NUMBER_PULSE_MS, 0.4) : 0
  const last = ticked === steps
  const number = up
    ? { scale: 1 + (last && won ? 0.2 : 0.12) * beat, dy: -2 * beat, opacity: 1 }
    : { scale: 1 - 0.06 * beat, dy: 2 * beat, opacity: 1 - 0.35 * beat }

  // The label and the crown fill with the front; a white glow sweeps through the label the same way.
  const front = sine(ms / FRONT_MS)
  const arrived = ms >= FRONT_MS
  let crown = lerp(change.fromCrown, toCrown, front)
  let crownScale = 1
  let labelScale = 1
  const stars: GaugeStar[] = []
  if (won && arrived) {
    const since = ms - FRONT_MS
    end = Math.max(end, FRONT_MS + 11 * 18 + 1200)
    crown = lerp(toCrown, 1, sine(since / 260))
    if (since < 800) {
      const q = sine(since / 800)
      crownScale = q < 0.35 ? lerp(1, 1.4, q / 0.35) : q < 0.7 ? lerp(1.4, 0.95, (q - 0.35) / 0.35) : lerp(0.95, 1, (q - 0.7) / 0.3)
      labelScale = 1 + 0.08 * peakAt(since / 800, 0.4)
    }
    // Twelve four-point stars in gold and the world's colour, bursting up from the crown.
    for (let k = 0; k < 12; k++) {
      const duration = 900 + hash(k + 0.3) * 300
      const q = (since - k * 18) / duration
      if (q <= 0 || q >= 1) continue
      const e = outQuint(q)
      const deg = -90 + (k - 5.5) * 20 + (hash(k + 0.7) * 8 - 4)
      const reach = (18 + hash(k + 1.9) * 16) * (e < 0.45 ? (0.7 * e) / 0.45 : 0.7 + (0.3 * (e - 0.45)) / 0.55)
      stars.push({
        x: 92 + reach * Math.cos((deg * Math.PI) / 180),
        y: 124 + reach * Math.sin((deg * Math.PI) / 180),
        size: k % 3 === 0 ? 4.5 : 2.6,
        scale: e < 0.45 ? (1.2 * e) / 0.45 : 1.2 * (1 - (e - 0.45) / 0.55),
        rotate: 90 * e,
        opacity: e < 0.45 ? 1 : 1 - (e - 0.45) / 0.55,
        gold: k % 2 === 0,
      })
    }
  }

  return {
    count: steps === 0 ? to : from + (up ? ticked : -ticked),
    p: lerp(change.fromP, toP, front),
    crown,
    sweep: arrived ? null : up ? -0.2 + 1.4 * front : 1.2 - 1.4 * front,
    sweepStrength: won ? 0.9 : up ? 0.8 : 0.4,
    bars,
    number,
    crownScale,
    labelScale,
    stars,
    done: ms >= end,
  }
}

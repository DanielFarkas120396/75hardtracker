import type { PainterKind } from '@logic/fillKinds'
import type { FillPalette } from '@logic/fillPalette'
import { DRIFT_MS, frameDecision, frameDt } from '@logic/fillSchedule'
import { FILLS, type NativePainter, type Uniforms } from './shaders'

/** Reduce motion's crossfade to a new level. */
export const FADE_S = 0.25

/** 'animate' plays the fill's own animation; 'fade' crossfades to the new level (reduce motion); 'instant' just shows it. */
export type LevelMode = 'animate' | 'fade' | 'instant'

/** A value the drawing reads on the phone's UI thread (a Reanimated shared value). */
interface Slot<T> {
  value: T
}

/** Where a tile's fill is drawn: what its canvas reads. */
export interface FillSurface {
  /** The frame to draw. */
  uniforms: Slot<Uniforms>
  /** During a crossfade: the frame it fades from, and how far in the new one is (1 when not fading). */
  previous: Slot<Uniforms>
  fade: Slot<number>
}

/** A tile's fill, as the engine hands it to the tile. */
export interface FillHandle {
  setLevel(level: number, mode: LevelMode): void
  shown(): number
  /** The level the fill has settled at, or null while it moves. */
  settledAt(): number | null
  setAnchor(right: number, top: number): void
  /** Whether the day's photo is decoded, for the iris. */
  setHasImage(has: boolean): void
  /** The tile's size in points; nothing is drawn before it is known. */
  setSize(width: number, height: number): void
  remove(): void
}

export interface FillEngine {
  /** Whether this kind of fill can be drawn on this phone (the others keep the thin bar). */
  supports(kind: PainterKind): boolean
  /** Starts a fill drawn into `surface`; `onFrame` runs after each frame drawn for it. */
  add(kind: PainterKind, surface: FillSurface, onFrame: () => void): FillHandle
  /** While a sheet covers the board, or Today is not in front, nothing is stepped or drawn (the drift stops too). */
  hold(held: boolean): void
  /** A new world or theme recolours every fill. */
  setPalette(palette: FillPalette): void
  setReduceMotion(reduce: boolean): void
}

interface Entry {
  painter: NativePainter
  surface: FillSurface
  level: number
  size: { width: number; height: number } | null
  dirty: boolean
  /** The painter moved on the last frame: when it stops, its resting frame still needs drawing. */
  wasMoving: boolean
  fading: boolean
  fade: number
  /** The last frame drawn: what a crossfade starts from. */
  drawn: Uniforms | null
  onFrame: () => void
}

interface EngineOptions {
  /** The kinds whose shader compiled on this phone. */
  supports: (kind: PainterKind) => boolean
  palette: FillPalette
  requestFrame?: (frame: (now: number) => void) => number
  cancelFrame?: (id: number) => void
  now?: () => number
}

/**
 * Steps every tile's fill on the board and hands each frame's numbers to its canvas. The web's engine
 * (src/screens/Today/fills/engine.ts) without its shared WebGL canvas: the loop runs only while a fill moves, fades
 * or drifts (drift at 30 frames a second), and not at all while held.
 */
export function createFillEngine(options: EngineOptions): FillEngine {
  const requestFrame = options.requestFrame ?? requestAnimationFrame
  const cancelFrame = options.cancelFrame ?? cancelAnimationFrame
  const now = options.now ?? (() => performance.now())
  const entries = new Set<Entry>()
  let palette = options.palette
  let reduce = false
  let held = false
  let raf: number | null = null
  let last = 0
  let lastDrift = 0

  const kick = () => {
    if (raf !== null || held || entries.size === 0) return
    last = now()
    raf = requestFrame(frame)
  }

  function draw(entry: Entry, width: number, height: number) {
    const first = entry.drawn === null
    entry.drawn = entry.painter.uniforms(width, height, palette)
    entry.surface.uniforms.value = entry.drawn
    // A crossfade's under-layer always has a whole frame to draw, even before the first fade.
    if (first) entry.surface.previous.value = entry.drawn
    entry.surface.fade.value = entry.fading ? entry.fade : 1
  }

  function frame(time: number) {
    raf = null
    if (held) return
    const dt = frameDt(time, last)
    last = time
    const driftDue = time - lastDrift >= DRIFT_MS
    if (driftDue) lastDrift = time
    let again = false
    for (const entry of entries) {
      if (!entry.size) continue
      const moving = entry.painter.step(dt, !reduce)
      const settling = entry.wasMoving && !moving
      entry.wasMoving = moving
      if (entry.fading) entry.fade = Math.min(1, entry.fade + dt / FADE_S)
      const decision = frameDecision({ moving, settling, fading: entry.fading, dirty: entry.dirty, drifting: !reduce && entry.painter.drifts() }, driftDue)
      if (decision.draw) {
        draw(entry, entry.size.width, entry.size.height)
        entry.dirty = false
        if (entry.fading && entry.fade >= 1) entry.fading = false
        entry.onFrame()
      }
      if (decision.again) again = true
    }
    if (again) raf = requestFrame(frame)
  }

  const redrawAll = () => {
    for (const entry of entries) entry.dirty = true
    kick()
  }

  return {
    supports: options.supports,
    hold(value) {
      held = value
      if (!held) return kick()
      if (raf !== null) cancelFrame(raf)
      raf = null
    },
    setPalette(next) {
      palette = next
      redrawAll()
    },
    setReduceMotion(value) {
      reduce = value
      redrawAll()
    },
    add(kind, surface, onFrame) {
      const entry: Entry = { painter: FILLS[kind].create(), surface, level: 0, size: null, dirty: true, wasMoving: false, fading: false, fade: 1, drawn: null, onFrame }
      entries.add(entry)
      kick()
      return {
        setLevel(level, mode) {
          if (level === entry.level && mode !== 'instant') return
          entry.level = level
          if (mode === 'fade' && entry.drawn) {
            surface.previous.value = entry.drawn
            surface.fade.value = 0
            entry.fading = true
            entry.fade = 0
          }
          entry.painter.setLevel(level, mode !== 'animate')
          entry.dirty = true
          kick()
        },
        shown: () => entry.painter.shown(),
        settledAt: () => (entry.painter.settled() && !entry.fading ? entry.level : null),
        setAnchor(right, top) {
          entry.painter.setAnchor?.(right, top)
        },
        setHasImage(has) {
          entry.painter.setHasImage?.(has)
          entry.dirty = true
          kick()
        },
        setSize(width, height) {
          if (!width || !height || (entry.size?.width === width && entry.size.height === height)) return
          entry.size = { width, height }
          entry.dirty = true
          kick()
        },
        remove() {
          entries.delete(entry)
        },
      }
    },
  }
}

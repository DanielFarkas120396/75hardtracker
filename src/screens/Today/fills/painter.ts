import type { WebGLRenderer } from 'three'
import type { TaskId } from '../../../logic/types'
import type { FillPalette } from './palette'

/** The look a task's tile fills with, as chosen in docs/prototypes/. */
export type PainterKind = 'wave' | 'ink' | 'sprint' | 'iris' | 'book'

export const TASK_PAINTER: Record<TaskId, PainterKind> = {
  water: 'wave',
  diet: 'ink',
  workouts: 'sprint',
  photo: 'iris',
  reading: 'book',
}

/** One tile's fill, drawn with the board's shared three.js renderer. */
export interface Painter {
  /** Moves the fill to `level` (0–1), animated unless `instant`. */
  setLevel(level: number, instant: boolean): void
  /** Advances by `dt` seconds; `drift` is false under reduce motion. True while the fill still moves. */
  step(dt: number, drift: boolean): boolean
  /** True while the fill shows something that keeps drifting (ink, waves, flow): it wants idle frames. */
  drifts(): boolean
  /** The level the fill shows right now, 0–1. */
  shown(): number
  /** The fill has reached its level and looks complete. */
  settled(): boolean
  /** Draws the fill for a tile of this size (CSS px) into the renderer's current viewport. */
  render(renderer: WebGLRenderer, width: number, height: number): void
  setPalette(palette: FillPalette): void
  /** Where the control the fill starts from sits (the switches, a chip): px from the tile's right edge and from its top. */
  setAnchor?(right: number, top: number): void
  /** The day's photo, for the iris. */
  setImage?(image: ImageBitmap | null): void
  dispose(): void
}

/** 'animate' plays the fill's own animation; 'fade' crossfades to the new level (reduce motion); 'instant' just shows it. */
export type LevelMode = 'animate' | 'fade' | 'instant'

/** A tile's fill, as the engine hands it to the tile. */
export interface FillHandle {
  setLevel(level: number, mode: LevelMode): void
  shown(): number
  /** The level the fill has settled at, or null while it moves. */
  settledAt(): number | null
  setAnchor(right: number, top: number): void
  setImage(image: ImageBitmap | null): void
  remove(): void
}

export interface FillEngine {
  /** Whether this kind of fill is built yet (the others keep the thin bar). */
  supports(kind: PainterKind): boolean
  /** Starts drawing a fill into `canvas`; `onFrame` runs after each frame drawn for it. */
  add(kind: PainterKind, canvas: HTMLCanvasElement, onFrame: () => void): FillHandle
  /** True while the WebGL context is lost: the tiles show the thin bar meanwhile. */
  lost(): boolean
  subscribe(listener: () => void): () => void
  /** While a sheet covers the board, nothing is stepped or drawn (the drift stops too). */
  hold(held: boolean): void
}

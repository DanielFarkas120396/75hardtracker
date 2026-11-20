import type { TaskId } from './types'

/** The look a task's tile fills with, as chosen in docs/prototypes/. */
export type PainterKind = 'wave' | 'ink' | 'sprint' | 'iris' | 'book'

export const TASK_PAINTER: Record<TaskId, PainterKind> = {
  water: 'wave',
  diet: 'ink',
  workouts: 'sprint',
  photo: 'iris',
  reading: 'book',
}

/**
 * A fill's timing and numbers, without its drawing: the web app draws a frame with three.js, the native app with
 * Skia. Both step the same model, so a fill moves the same on both.
 */
export interface FillModel<Frame> {
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
  /** Where the control the fill starts from sits (the switches, a chip): px from the tile's right edge and from its top. */
  setAnchor?(right: number, top: number): void
  /** The numbers to draw a tile of this size with (px). Called once per frame drawn. */
  frame(width: number, height: number): Frame
}

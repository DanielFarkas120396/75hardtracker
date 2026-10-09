/** Idle drift (the ink, the waves, the flow) is drawn at 30 frames a second; anything moving, every frame. */
export const DRIFT_MS = 1000 / 30

export interface FrameNeeds {
  moving: boolean
  fading: boolean
  dirty: boolean
  drifting: boolean
}

/** Whether a tile's fill is drawn this frame, and whether the loop must go on for it. */
export function frameDecision(needs: FrameNeeds, driftDue: boolean): { draw: boolean; again: boolean } {
  return {
    draw: needs.moving || needs.fading || needs.dirty || (needs.drifting && driftDue),
    again: needs.moving || needs.fading || needs.drifting,
  }
}

/**
 * Seconds since the last frame, at most 0.05. Never negative: a frame's timestamp is its start time, which can come
 * before the performance.now() taken when the loop was kicked, and a step back in time would break a painter.
 */
export function frameDt(now: number, last: number): number {
  return Math.max(0, Math.min(0.05, (now - last) / 1000 || 0))
}

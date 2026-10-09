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

import { CHALLENGE_LENGTH } from './constants'
import { WORLD_SPANS, type WorldId } from './worlds'

export interface ClimbSegment {
  id: WorldId
  /** The world's share of the 75 days, 0 to 1. */
  share: number
  /** How much of the world has been reached, 0 to 1. */
  fill: number
}

/**
 * The climb through the six worlds as segments of one bar, filled up to the
 * day reached (today's day, or every day after victory).
 */
export function climbSegments(dayReached: number): ClimbSegment[] {
  const day = Number.isFinite(dayReached) ? Math.min(CHALLENGE_LENGTH, Math.max(0, dayReached)) : 0
  return WORLD_SPANS.map((world) => {
    const length = world.lastDay - world.firstDay + 1
    return {
      id: world.id,
      share: length / CHALLENGE_LENGTH,
      fill: Math.min(1, Math.max(0, (day - world.firstDay + 1) / length)),
    }
  })
}

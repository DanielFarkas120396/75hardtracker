import { CHALLENGE_LENGTH } from './constants'

/** Yesterday stays open for logging until noon (minutes since local midnight). */
export const GRACE_END_MIN = 12 * 60

/**
 * The "late day": yesterday, while it can still be finished — before noon,
 * when it's one of Day 1–75. Until then, an unfinished yesterday isn't a
 * missed day: you may have done it all and just forgotten to log it.
 */
export function lateDayNumber(todayDayNumber: number, nowMin: number): number | null {
  if (!Number.isFinite(todayDayNumber) || nowMin >= GRACE_END_MIN) return null
  const yesterday = todayDayNumber - 1
  return yesterday >= 1 && yesterday <= CHALLENGE_LENGTH ? yesterday : null
}

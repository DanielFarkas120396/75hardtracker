import { CHALLENGE_LENGTH } from './constants'

/** True for a whole day number inside the challenge (1..CHALLENGE_LENGTH). */
export function isChallengeDay(dayNumber: number): boolean {
  return Number.isInteger(dayNumber) && dayNumber >= 1 && dayNumber <= CHALLENGE_LENGTH
}

/**
 * Days left until Day 1 while the challenge hasn't started yet
 * (`todayDayNumber` < 1); 0 once it has started.
 */
export function daysUntilStart(todayDayNumber: number): number {
  return Number.isFinite(todayDayNumber) && todayDayNumber < 1 ? 1 - todayDayNumber : 0
}

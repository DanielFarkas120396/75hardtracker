import type { DayCompletionSummary } from './types'

/**
 * Current streak: the number of consecutive completed days counting
 * backward from the most recent day number. Stops at the first incomplete
 * (or missing) day.
 */
export function calculateStreak(entries: DayCompletionSummary[]): number {
  const sorted = [...entries].sort((a, b) => a.dayNumber - b.dayNumber)

  let streak = 0
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].completed) {
      streak++
    } else {
      break
    }
  }
  return streak
}

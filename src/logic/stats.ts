import { isDayComplete } from './dayCompletion'
import type { Ruleset } from './rulesets'
import type { ChallengeDayData } from './types'

/** An attempt's running totals, as shown on Stats and the victory screen. */
export interface ChallengeStats {
  perfectDays: number
  water_ml: number
  pages: number
  workoutMinutes: number
}

export const EMPTY_CHALLENGE_STATS: ChallengeStats = { perfectDays: 0, water_ml: 0, pages: 0, workoutMinutes: 0 }

/** Adds up an attempt's logged days. */
export function calculateChallengeStats(days: readonly ChallengeDayData[], rules: Ruleset): ChallengeStats {
  const stats: ChallengeStats = { ...EMPTY_CHALLENGE_STATS }
  for (const { data } of days) {
    stats.water_ml += data.water_ml
    stats.pages += data.pages_read
    stats.workoutMinutes += data.workouts.reduce((sum, w) => sum + w.durationMin, 0)
    if (isDayComplete(data, rules)) stats.perfectDays += 1
  }
  return stats
}

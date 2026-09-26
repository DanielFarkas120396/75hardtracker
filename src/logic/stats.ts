import { isDayComplete } from './dayCompletion'
import type { Ruleset } from './rulesets'
import type { ChallengeDayData } from './types'
import { calculateChallengeXp } from './xp'

/** An attempt's XP and running totals, as shown on Today, Journey, Stats and the victory screen. */
export interface ChallengeStats {
  xp: number
  perfectDays: number
  water_ml: number
  pages: number
  workoutMinutes: number
}

export const EMPTY_CHALLENGE_STATS: ChallengeStats = { xp: 0, perfectDays: 0, water_ml: 0, pages: 0, workoutMinutes: 0 }

/** Adds up an attempt's logged days. XP uses calculateChallengeXp's gap-aware streak. */
export function calculateChallengeStats(days: readonly ChallengeDayData[], rules: Ruleset): ChallengeStats {
  const stats: ChallengeStats = { ...EMPTY_CHALLENGE_STATS, xp: calculateChallengeXp(days, rules) }
  for (const { data } of days) {
    stats.water_ml += data.water_ml
    stats.pages += data.pages_read
    stats.workoutMinutes += data.workouts.reduce((sum, w) => sum + w.durationMin, 0)
    if (isDayComplete(data, rules)) stats.perfectDays += 1
  }
  return stats
}

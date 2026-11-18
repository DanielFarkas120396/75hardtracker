import { groupWorkoutsByEntry, toDayTaskData } from '@logic/mappers'
import { rulesFor, type Ruleset } from '@logic/rulesets'
import { calculateChallengeStats, EMPTY_CHALLENGE_STATS, type ChallengeStats } from '@logic/stats'
import type { ChallengeDayData } from '@logic/types'
import { challengeRepo } from '../db/repositories/challengeRepo'
import { dayEntryRepo } from '../db/repositories/dayEntryRepo'
import { workoutRepo } from '../db/repositories/workoutRepo'
import { useLiveQuery } from '../db/useLiveQuery'

/** An attempt's rules and its logged days as the rules see them (the web's loadChallengeDays). */
export async function loadChallengeDays(challengeId: number): Promise<{ rules: Ruleset; days: ChallengeDayData[] }> {
  const challenge = await challengeRepo.getById(challengeId)
  const entries = await dayEntryRepo.getAllForChallenge(challengeId)
  const workoutsByEntry = groupWorkoutsByEntry(await workoutRepo.getForDayEntries(entries.map((entry) => entry.id)))
  const days = entries.map((entry) => ({ dayNumber: entry.dayNumber, data: toDayTaskData(entry, workoutsByEntry.get(entry.id) ?? [], challenge?.socialDays) }))
  return { rules: rulesFor(challenge ?? {}), days }
}

/** Running totals for one attempt. All zeros while loading. */
export function useChallengeStats(challengeId: number): ChallengeStats {
  return (
    useLiveQuery(async () => {
      const { rules, days } = await loadChallengeDays(challengeId)
      return calculateChallengeStats(days, rules)
    }, [challengeId]) ?? EMPTY_CHALLENGE_STATS
  )
}

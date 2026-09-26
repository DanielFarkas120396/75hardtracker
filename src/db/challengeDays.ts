import { rulesFor, type Ruleset } from '../logic/rulesets'
import type { ChallengeDayData } from '../logic/types'
import { groupWorkoutsByEntry, toDayTaskData } from './mappers'
import { challengeRepo } from './repositories/challengeRepo'
import { dayEntryRepo } from './repositories/dayEntryRepo'
import { workoutRepo } from './repositories/workoutRepo'

/**
 * An attempt's rules and its logged days as the logic module sees them: its
 * day entries and all their workouts, in three queries. Read-only — safe
 * inside a live query.
 */
export async function loadChallengeDays(challengeId: number): Promise<{ rules: Ruleset; days: ChallengeDayData[] }> {
  const challenge = await challengeRepo.getById(challengeId)
  const entries = await dayEntryRepo.getAllForChallenge(challengeId)
  const workoutsByEntry = groupWorkoutsByEntry(await workoutRepo.getForDayEntries(entries.map((e) => e.id)))
  const days = entries.map((entry) => ({
    dayNumber: entry.dayNumber,
    data: toDayTaskData(entry, workoutsByEntry.get(entry.id) ?? []),
  }))
  return { rules: rulesFor(challenge ?? {}), days }
}

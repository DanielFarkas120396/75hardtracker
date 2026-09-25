import type { ChallengeDayData } from '../logic/types'
import { groupWorkoutsByEntry, toDayTaskData } from './mappers'
import { dayEntryRepo } from './repositories/dayEntryRepo'
import { workoutRepo } from './repositories/workoutRepo'

/**
 * An attempt's logged days as the logic module sees them: its day entries
 * and all their workouts, in two queries. Read-only — safe inside a live query.
 */
export async function loadChallengeDays(challengeId: number): Promise<ChallengeDayData[]> {
  const entries = await dayEntryRepo.getAllForChallenge(challengeId)
  const workoutsByEntry = groupWorkoutsByEntry(await workoutRepo.getForDayEntries(entries.map((e) => e.id)))
  return entries.map((entry) => ({
    dayNumber: entry.dayNumber,
    data: toDayTaskData(entry, workoutsByEntry.get(entry.id) ?? []),
  }))
}

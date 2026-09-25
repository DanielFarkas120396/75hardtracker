import { useLiveQuery } from 'dexie-react-hooks'
import { groupWorkoutsByEntry, toDayTaskData } from '../db/mappers'
import { challengeRepo } from '../db/repositories/challengeRepo'
import { dayEntryRepo } from '../db/repositories/dayEntryRepo'
import { workoutRepo } from '../db/repositories/workoutRepo'
import type { Challenge } from '../db/types'
import { dayNumberForDate } from '../lib/dates'
import { summarizeAttempt, type AttemptSummary } from '../logic/attempts'
import type { ChallengeDayData } from '../logic/types'

export interface AttemptRecord {
  challenge: Challenge
  summary: AttemptSummary
  /** The attempt's logged days, for the detail view. */
  days: ChallengeDayData[]
}

/**
 * Every attempt, newest first, with its summary — challenges, day entries
 * and workouts loaded in one live query. `today` places the running attempt.
 */
export function useAttemptSummaries(today: string): AttemptRecord[] | undefined {
  return useLiveQuery(async () => {
    const challenges = await challengeRepo.getAll()
    const entries = await dayEntryRepo.getAllForChallenges(challenges.map((c) => c.id))
    const workoutsByEntry = groupWorkoutsByEntry(await workoutRepo.getForDayEntries(entries.map((e) => e.id)))

    const daysByChallenge = new Map<number, ChallengeDayData[]>()
    for (const entry of entries) {
      const day = { dayNumber: entry.dayNumber, data: toDayTaskData(entry, workoutsByEntry.get(entry.id) ?? []) }
      const days = daysByChallenge.get(entry.challengeId)
      if (days) days.push(day)
      else daysByChallenge.set(entry.challengeId, [day])
    }

    return challenges.reverse().map((challenge) => {
      const days = daysByChallenge.get(challenge.id) ?? []
      const summary = summarizeAttempt({
        startDate: challenge.startDate,
        status: challenge.status,
        days,
        todayDayNumber: dayNumberForDate(challenge.startDate, today),
      })
      return { challenge, summary, days }
    })
  }, [today])
}

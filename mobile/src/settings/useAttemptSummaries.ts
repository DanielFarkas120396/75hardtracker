import { summarizeAttempt, type AttemptSummary } from '@logic/attempts'
import { dayNumberForDate } from '@logic/dates'
import { groupWorkoutsByEntry, toDayTaskData } from '@logic/mappers'
import { rulesFor } from '@logic/rulesets'
import type { ChallengeDayData } from '@logic/types'
import { challengeRepo } from '../db/repositories/challengeRepo'
import { dayEntryRepo } from '../db/repositories/dayEntryRepo'
import { workoutRepo } from '../db/repositories/workoutRepo'
import type { Challenge, DayEntry } from '../db/types'
import { useLiveQuery } from '../db/useLiveQuery'

export interface AttemptRecord {
  challenge: Challenge
  summary: AttemptSummary
  /** The attempt's logged days as the rules see them, for its page. */
  days: ChallengeDayData[]
  /** Its day entries, for its photos. */
  entries: DayEntry[]
}

/**
 * Every attempt, newest first, with its summary: challenges, day entries and workouts read at once. `today` places
 * the running attempt. The web's useAttemptSummaries.
 */
export function useAttemptSummaries(today: string): AttemptRecord[] | undefined {
  return useLiveQuery(async () => {
    const challenges = await challengeRepo.getAll()
    const entries = await dayEntryRepo.getAllForChallenges(challenges.map((c) => c.id))
    const workoutsByEntry = groupWorkoutsByEntry(await workoutRepo.getForDayEntries(entries.map((e) => e.id)))
    return [...challenges].reverse().map((challenge) => {
      const own = entries.filter((entry) => entry.challengeId === challenge.id)
      const days = own.map((entry) => ({ dayNumber: entry.dayNumber, data: toDayTaskData(entry, workoutsByEntry.get(entry.id) ?? [], challenge.socialDays) }))
      const summary = summarizeAttempt({
        restoredDays: challenge.restoredDays,
        startDate: challenge.startDate,
        status: challenge.status,
        abandonedOn: challenge.abandonedOn,
        days,
        todayDayNumber: dayNumberForDate(challenge.startDate, today),
        rules: rulesFor(challenge),
      })
      return { challenge, summary, days, entries: own }
    })
  }, [today])
}

import { isDayComplete } from '../logic/dayCompletion'
import { rulesFor } from '../logic/rulesets'
import { db } from './db'
import { toDayTaskData } from './mappers'

/** The tables a transaction must cover to call syncDayCompletion. */
export const COMPLETION_TABLES = [db.dayEntries, db.workouts, db.challenges] as const

/**
 * Recomputes a DayEntry's persisted `completed` flag from its data, its
 * workouts and its attempt's rules. Call it inside the same read-write
 * transaction (over COMPLETION_TABLES) as the change that may affect
 * completion, so the flag can never disagree with the data it summarizes.
 */
export async function syncDayCompletion(entryId: number): Promise<void> {
  const entry = await db.dayEntries.get(entryId)
  if (!entry) return
  const challenge = await db.challenges.get(entry.challengeId)
  const workouts = await db.workouts.where('dayEntryId').equals(entryId).toArray()
  const completed = isDayComplete(toDayTaskData(entry, workouts, challenge?.socialDays), rulesFor(challenge ?? {}))
  if (completed !== entry.completed) {
    await db.dayEntries.update(entryId, { completed })
  }
}

import { isDayComplete } from '../logic/dayCompletion'
import { db } from './db'
import { toDayTaskData } from './mappers'

/**
 * Recomputes a DayEntry's persisted `completed` flag from its data and
 * workouts. Call it inside the same read-write transaction (covering
 * dayEntries and workouts) as the change that may affect completion, so the
 * flag can never disagree with the data it summarizes.
 */
export async function syncDayCompletion(entryId: number): Promise<void> {
  const entry = await db.dayEntries.get(entryId)
  if (!entry) return
  const workouts = await db.workouts.where('dayEntryId').equals(entryId).toArray()
  const completed = isDayComplete(toDayTaskData(entry, workouts))
  if (completed !== entry.completed) {
    await db.dayEntries.update(entryId, { completed })
  }
}

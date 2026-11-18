import { isDayComplete } from '@logic/dayCompletion'
import { toDayTaskData } from '@logic/mappers'
import { rulesFor } from '@logic/rulesets'
import type { Db } from './driver'
import { allRows, getRow, updateRow } from './table'

/**
 * Recomputes a day entry's saved `completed` flag from its data, its workouts
 * and its attempt's rules. Call it inside the same transaction as the change
 * that may affect completion, so the flag can never disagree with the data it
 * sums up. The web app's syncDayCompletion (src/db/completion.ts).
 */
export async function syncDayCompletion(db: Db, entryId: number): Promise<void> {
  const entry = await getRow(db, 'dayEntries', entryId)
  if (!entry) return
  const challenge = await getRow(db, 'challenges', entry.challengeId)
  const workouts = await allRows(db, 'workouts', 'WHERE dayEntryId = ?', [entryId])
  const completed = isDayComplete(toDayTaskData(entry, workouts, challenge?.socialDays), rulesFor(challenge ?? {}))
  if (completed !== entry.completed) await updateRow(db, 'dayEntries', entryId, { completed })
}

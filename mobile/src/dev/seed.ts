import { addDaysISO, todayISO } from '@logic/dates'
import { transaction } from '../db/open'
import { challengeToParams, INSERT_CHALLENGE } from '../db/rows'
import { TABLE_NAMES } from '../db/schema'

/**
 * Developer tool: erases everything and starts a 75 Hard attempt whose Day
 * `day` is today (a day of 0 or less starts in the future). The fuller
 * scenarios of the web app (src/dev/scenarios.ts) come with the screens they exercise.
 */
export async function seedDay(day: number): Promise<void> {
  await transaction(async (db) => {
    for (const table of TABLE_NAMES) await db.execAsync(`DELETE FROM ${table}`)
    await db.runAsync(
      INSERT_CHALLENGE,
      challengeToParams({
        startDate: addDaysISO(todayISO(), 1 - day),
        attemptNumber: 1,
        status: 'active',
        variant: 'hard',
      }),
    )
  })
}

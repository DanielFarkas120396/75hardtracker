import { addDaysISO, todayISO } from '@logic/dates'
import { transaction } from '../db/open'
import { challengeToParams, INSERT_CHALLENGE } from '../db/rows'

const TABLES = ['challenges', 'dayEntries', 'workouts', 'books', 'measurements', 'photos', 'badges', 'settings']

/**
 * Developer tool: erases everything and starts a 75 Hard attempt whose Day
 * `day` is today (a day of 0 or less starts in the future). The fuller
 * scenarios of the web app (src/dev/scenarios.ts) come with the screens they exercise.
 */
export async function seedDay(day: number): Promise<void> {
  await transaction(async (db) => {
    for (const table of TABLES) await db.execAsync(`DELETE FROM ${table}`)
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

import { addDaysISO } from '@logic/dates'
import { RULESETS } from '@logic/rulesets'
import { setDbForTests, transaction } from '../open'
import { challengeToParams, INSERT_CHALLENGE } from '../rows'
import { insertRow } from '../table'
import type { Challenge } from '../types'
import { freshDb } from './testDb'

/** Same names as the web app's fixtures (src/db/__tests__/fixtures.ts), so ported tests read the same. */

/** Gives the repositories a new, empty in-memory database. Call it at the start of each test. */
export async function freshDatabase(): Promise<void> {
  setDbForTests(await freshDb())
}

export async function addChallenge(challenge: Omit<Challenge, 'id'>): Promise<number> {
  return transaction(async (db) => (await db.runAsync(INSERT_CHALLENGE, challengeToParams(challenge))).lastInsertRowId)
}

/** Completed days `fromDay`..`toDay` (each with a photo row and two qualifying workouts), written directly, bypassing the repositories. */
export async function addPerfectDays(challengeId: number, startDate: string, fromDay: number, toDay: number): Promise<void> {
  await transaction(async (db) => {
    for (let dayNumber = fromDay; dayNumber <= toDay; dayNumber++) {
      const date = addDaysISO(startDate, dayNumber - 1)
      const photoId = await insertRow(db, 'photos', { date, file: `seed-${challengeId}-${dayNumber}.jpg`, mimeType: 'image/jpeg' })
      const dayEntryId = await insertRow(db, 'dayEntries', {
        challengeId,
        date,
        dayNumber,
        water_ml: RULESETS.hard.waterTargetMl,
        pages_read: RULESETS.hard.pagesTarget,
        dietFollowed: true,
        noAlcohol: true,
        photoId,
        completed: true,
      })
      await insertRow(db, 'workouts', { dayEntryId, type: 'Running', durationMin: RULESETS.hard.minWorkoutMin, isOutdoor: true })
      await insertRow(db, 'workouts', { dayEntryId, type: 'Weights', durationMin: RULESETS.hard.minWorkoutMin, isOutdoor: false })
    }
  })
}

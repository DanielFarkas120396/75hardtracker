import { getDb, setDbForTests } from '../open'
import { challengeToParams, INSERT_CHALLENGE } from '../rows'
import type { Challenge } from '../types'
import { freshDb } from './testDb'

/** Same names as the web app's fixtures (src/db/__tests__/fixtures.ts), so ported tests read the same. */

/** Gives the repositories a new, empty in-memory database. Call it at the start of each test. */
export async function freshDatabase(): Promise<void> {
  setDbForTests(await freshDb())
}

export async function addChallenge(challenge: Omit<Challenge, 'id'>): Promise<number> {
  const result = await getDb().runAsync(INSERT_CHALLENGE, challengeToParams(challenge))
  return result.lastInsertRowId
}

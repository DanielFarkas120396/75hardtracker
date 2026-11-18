/** @jest-environment node */
import { challengeFromRow, challengeToParams, INSERT_CHALLENGE, type ChallengeRow } from '../rows'
import type { Challenge } from '../types'
import { freshDb } from './testDb'

async function roundTrip(challenge: Omit<Challenge, 'id'>): Promise<Challenge> {
  const db = await freshDb()
  await db.runAsync(INSERT_CHALLENGE, challengeToParams(challenge))
  const row = await db.getFirstAsync<ChallengeRow>('SELECT * FROM challenges')
  return challengeFromRow(row!)
}

it('an old-style challenge reads back without its optional fields', async () => {
  const challenge = await roundTrip({ startDate: '2026-01-01', attemptNumber: 1, status: 'active' })
  expect(challenge).toStrictEqual({ id: 1, startDate: '2026-01-01', attemptNumber: 1, status: 'active' })
  expect('variant' in challenge).toBe(false)
})

it('keeps a challenge’s variant and lists', async () => {
  const full: Omit<Challenge, 'id'> = {
    startDate: '2026-01-01',
    attemptNumber: 2,
    status: 'abandoned',
    variant: 'soft',
    socialDays: [3, 9],
    jokersAcknowledged: 1,
    abandonedOn: '2026-01-20',
    restoredDays: [4],
  }
  expect(await roundTrip(full)).toStrictEqual({ id: 1, ...full })
})

it('keeps an empty list as an empty list', async () => {
  const challenge = await roundTrip({ startDate: '2026-01-01', attemptNumber: 1, status: 'active', socialDays: [] })
  expect(challenge.socialDays).toEqual([])
})

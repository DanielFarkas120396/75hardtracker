/** @jest-environment node */
import { getDb, setDbForTests } from '../open'
import { addChallenge, freshDatabase } from './fixtures'
import { freshDb } from './testDb'

it('says so when the database is used before it is open', () => {
  jest.isolateModules(() => {
    const { getDb: getUnopened } = require('../open') as typeof import('../open')
    expect(() => getUnopened()).toThrow('The database is not open yet.')
  })
})

it('hands out the open database', async () => {
  const db = await freshDb()
  setDbForTests(db)
  expect(getDb()).toBe(db)
})

it('gives each test a fresh database', async () => {
  await freshDatabase()
  expect(await addChallenge({ startDate: '2026-01-01', attemptNumber: 1, status: 'active' })).toBe(1)
  await freshDatabase()
  expect(await getDb().getAllAsync('SELECT * FROM challenges')).toEqual([])
})

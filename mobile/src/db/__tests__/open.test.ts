/** @jest-environment node */
import { getDb, setDbForTests, subscribeToChanges, transaction } from '../open'
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

describe('transaction', () => {
  beforeEach(freshDatabase)
  const insert = (key: string) => (db: ReturnType<typeof getDb>) =>
    db.runAsync('INSERT INTO settings (key, value) VALUES (?, ?)', [key, '1']).then(() => undefined)
  const keys = async () =>
    (await getDb().getAllAsync<{ key: string }>('SELECT key FROM settings ORDER BY key')).map((row) => row.key)

  it('undoes a task that fails, tells the caller, and keeps working afterwards', async () => {
    await expect(
      transaction(async (db) => {
        await insert('a')(db)
        throw new Error('stop')
      }),
    ).rejects.toThrow('stop')
    expect(await keys()).toEqual([])
    await transaction(insert('b'))
    expect(await keys()).toEqual(['b'])
  })

  it('gives back what the task returns', async () => {
    expect(await transaction(async () => 42)).toBe(42)
  })

  it('tells the listeners after a write, and not after a failed one', async () => {
    const listener = jest.fn()
    const stop = subscribeToChanges(listener)
    await transaction(insert('a'))
    expect(listener).toHaveBeenCalledTimes(1)
    await transaction(async () => {
      throw new Error('stop')
    }).catch(() => undefined)
    expect(listener).toHaveBeenCalledTimes(1)
    stop()
    await transaction(insert('b'))
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

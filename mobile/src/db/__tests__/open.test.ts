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

  it('tells the listeners after a write, and after a failed one too', async () => {
    const listener = jest.fn()
    const stop = subscribeToChanges(listener)
    await transaction(insert('a'))
    expect(listener).toHaveBeenCalledTimes(1)
    // A screen may have read while the failed write was in flight: it must reread.
    await transaction(async () => {
      throw new Error('stop')
    }).catch(() => undefined)
    expect(listener).toHaveBeenCalledTimes(2)
    stop()
    await transaction(insert('b'))
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('a listener that throws neither fails the write nor silences the next listener', async () => {
    const logged = jest.spyOn(console, 'error').mockImplementation(() => {})
    const second = jest.fn()
    const stopFirst = subscribeToChanges(() => {
      throw new Error('broken screen')
    })
    const stopSecond = subscribeToChanges(second)
    await expect(transaction(insert('a'))).resolves.toBeUndefined()
    expect(second).toHaveBeenCalledTimes(1)
    expect(logged).toHaveBeenCalled()
    stopFirst()
    stopSecond()
    logged.mockRestore()
  })

  describe('a write that waits on another write', () => {
    const WARNING = 'A write has waited 5 s for another write. A transaction task must not call transaction() or a repository write.'

    beforeEach(() => jest.useFakeTimers())
    afterEach(() => jest.useRealTimers())

    it('is reported after 5 s when a task writes inside itself', async () => {
      const logged = jest.spyOn(console, 'error').mockImplementation(() => {})
      // Never finishes: the inner write waits for the outer one, which waits for it.
      void transaction(async () => {
        await transaction(insert('a'))
      })
      await jest.advanceTimersByTimeAsync(5000)
      expect(logged).toHaveBeenCalledWith(WARNING)
      logged.mockRestore()
    })

    it('is not reported for writes that simply follow each other', async () => {
      const logged = jest.spyOn(console, 'error').mockImplementation(() => {})
      await Promise.all([transaction(insert('a')), transaction(insert('b'))])
      await jest.advanceTimersByTimeAsync(6000)
      expect(logged).not.toHaveBeenCalled()
      logged.mockRestore()
    })
  })
})

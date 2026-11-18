/** @jest-environment node */
import { migrate, MIGRATIONS } from '../schema'
import { freshDb } from './testDb'

it('creates the eight tables and records the version', async () => {
  const db = await freshDb()
  const tables = await db.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  )
  expect(tables.map((table) => table.name)).toEqual([
    'badges',
    'books',
    'challenges',
    'dayEntries',
    'measurements',
    'photos',
    'settings',
    'workouts',
  ])
  expect(await db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: MIGRATIONS.length })
})

it('migrating twice changes nothing', async () => {
  const db = await freshDb()
  await db.runAsync("INSERT INTO settings (key, value) VALUES ('bedtime', '\"22:30\"')")
  await expect(migrate(db)).resolves.toBeUndefined()
  expect(await db.getAllAsync('SELECT * FROM settings')).toEqual([{ key: 'bedtime', value: '"22:30"' }])
})

it('leaves a database from a newer version of the app alone', async () => {
  const db = await freshDb()
  await db.execAsync(`PRAGMA user_version = ${MIGRATIONS.length + 1}`)
  await expect(migrate(db)).resolves.toBeUndefined()
  expect(await db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: MIGRATIONS.length + 1 })
})

it('refuses a second entry for the same challenge day', async () => {
  const db = await freshDb()
  const insert = `INSERT INTO dayEntries (challengeId, date, dayNumber, water_ml, pages_read, dietFollowed, noAlcohol, completed)
    VALUES (1, '2026-01-01', 1, 0, 0, 0, 0, 0)`
  await db.runAsync(insert)
  await expect(db.runAsync(insert)).rejects.toThrow(/UNIQUE/)
})

it('accepts entries with no day number: an old backup may hold days it can’t place', async () => {
  const db = await freshDb()
  const insert = `INSERT INTO dayEntries (challengeId, date, dayNumber, water_ml, pages_read, dietFollowed, noAlcohol, completed)
    VALUES (1, '2024-01-01', NULL, 0, 0, 0, 0, 0)`
  await db.runAsync(insert)
  await db.runAsync(insert)
  expect(await db.getAllAsync('SELECT id FROM dayEntries')).toHaveLength(2)
})

it('keeps the rows when a database from the first version is brought up to date', async () => {
  const sqlite = await freshDb()
  // Back to version 1: the day number was required then.
  await sqlite.execAsync('DROP TABLE dayEntries')
  await sqlite.execAsync(MIGRATIONS[0].slice(MIGRATIONS[0].indexOf('CREATE TABLE dayEntries'), MIGRATIONS[0].indexOf('CREATE TABLE workouts')))
  await sqlite.execAsync('PRAGMA user_version = 1')
  await sqlite.runAsync(`INSERT INTO dayEntries (id, challengeId, date, dayNumber, water_ml, pages_read, dietFollowed, noAlcohol, notes, completed)
    VALUES (7, 1, '2026-01-01', 1, 3800, 10, 1, 1, 'kept', 1)`)
  await migrate(sqlite)
  expect(await sqlite.getFirstAsync('SELECT id, dayNumber, water_ml, notes, completed FROM dayEntries')).toEqual({
    id: 7,
    dayNumber: 1,
    water_ml: 3800,
    notes: 'kept',
    completed: 1,
  })
  const again = `INSERT INTO dayEntries (challengeId, date, dayNumber, water_ml, pages_read, dietFollowed, noAlcohol, completed) VALUES (1, '2026-01-01', 1, 0, 0, 0, 0, 0)`
  await expect(sqlite.runAsync(again)).rejects.toThrow(/UNIQUE/)
})

it('refuses the same badge twice in one attempt', async () => {
  const db = await freshDb()
  const insert = `INSERT INTO badges (badgeId, challengeId, unlockedAt) VALUES ('first-day', 1, '2026-01-01T20:00:00.000Z')`
  await db.runAsync(insert)
  await expect(db.runAsync(insert)).rejects.toThrow(/UNIQUE/)
})

it('undoes a transaction that fails', async () => {
  const db = await freshDb()
  await expect(
    db.withTransactionAsync(async () => {
      await db.runAsync("INSERT INTO settings (key, value) VALUES ('a', '1')")
      throw new Error('stop')
    }),
  ).rejects.toThrow('stop')
  expect(await db.getAllAsync('SELECT * FROM settings')).toEqual([])
})

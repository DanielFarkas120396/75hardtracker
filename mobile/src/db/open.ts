import * as SQLite from 'expo-sqlite'
import type { Db } from './driver'
import { migrate } from './schema'

let current: Db | null = null
let queue: Promise<unknown> = Promise.resolve()
const listeners = new Set<() => void>()

/** Opens the app's database and brings it up to date. Called once, at launch. */
export async function openAppDatabase(name = 'app.db'): Promise<Db> {
  const sqlite = await SQLite.openDatabaseAsync(name)
  // expo-sqlite wants its parameters spelled out; the app's calls may leave them off.
  const db: Db = {
    execAsync: (sql) => sqlite.execAsync(sql),
    runAsync: (sql, params = []) => sqlite.runAsync(sql, params),
    getAllAsync: (sql, params = []) => sqlite.getAllAsync(sql, params),
    getFirstAsync: (sql, params = []) => sqlite.getFirstAsync(sql, params),
    withTransactionAsync: (task) => sqlite.withTransactionAsync(task),
  }
  await migrate(db)
  current = db
  return db
}

/** The open database, for reading. Writes go through `transaction`. */
export function getDb(): Db {
  if (current === null) throw new Error('The database is not open yet.')
  return current
}

/** Tests swap in an in-memory database (see __tests__/fixtures.ts). */
export function setDbForTests(db: Db): void {
  current = db
}

/**
 * Every write goes through here. The task runs in a transaction (undone if it
 * throws), and transactions run one after the other, so two taps at once can't
 * both "check, then insert". Screens reading through useLiveQuery reread after it.
 *
 * ponytail: one queue on the JS side, on one connection. A read outside a
 * transaction can see one in flight; use expo-sqlite's exclusive transactions
 * if that ever matters.
 */
export function transaction<T>(task: (db: Db) => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const db = getDb()
    let result!: T
    await db.withTransactionAsync(async () => {
      result = await task(db)
    })
    for (const listener of [...listeners]) listener()
    return result
  })
  queue = run.catch(() => undefined)
  return run
}

/** Calls the listener after every write. Returns the way to stop. */
export function subscribeToChanges(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

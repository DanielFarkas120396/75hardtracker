import * as SQLite from 'expo-sqlite'
import type { Db, SqlValue } from './driver'
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

/** Tests swap in an in-memory database (see __tests__/fixtures.ts), with an empty write queue. */
export function setDbForTests(db: Db): void {
  current = db
  queue = Promise.resolve()
}

const STUCK_WRITE =
  'A write has waited 5 s for another write. A transaction task must not call transaction() or a repository write.'

/**
 * Every write goes through here. The task runs in a transaction (undone if it
 * throws), and transactions run one after the other, so two taps at once can't
 * both "check, then insert". Screens reading through useLiveQuery reread after it,
 * even when it failed (they may have read while it was in flight).
 *
 * A task must never call `transaction` or a repository write itself: that write
 * would wait for the task, which waits for it, and every later write with them.
 *
 * ponytail: one queue on the JS side, on one connection. A read outside a
 * transaction can see one in flight; use expo-sqlite's exclusive transactions
 * if that ever matters.
 */
export function transaction<T>(task: (db: Db) => Promise<T>): Promise<T> {
  const stuck = __DEV__ ? setTimeout(() => console.error(STUCK_WRITE), 5000) : undefined
  const run = queue.then(async () => {
    clearTimeout(stuck)
    const db = getDb()
    let result!: T
    let taskError: { error: unknown } | undefined
    try {
      await db.withTransactionAsync(async () => {
        try {
          result = await task(watched(db))
        } catch (error) {
          taskError = { error }
          throw error
        }
      })
    } catch (error) {
      // The database refused (a full phone, a broken file), not the task saying no: the app shows "Couldn't save that".
      const fromTask = taskError !== undefined && taskError.error === error
      if (!fromTask || (typeof error === 'object' && error !== null && sqlFailures.has(error))) onSaveFailure?.()
      throw error
    } finally {
      for (const listener of [...listeners]) {
        try {
          listener()
        } catch (error) {
          // A broken screen must not make a saved write look failed.
          console.error(error)
        }
      }
    }
    return result
  })
  queue = run.catch(() => undefined)
  return run
}

const sqlFailures = new WeakSet<object>()
let onSaveFailure: (() => void) | undefined

/** Called when a write fails in the database itself. Set once, by the toasts. */
export function setSaveFailureListener(listener: (() => void) | undefined): void {
  onSaveFailure = listener
}

/** The database as a task sees it: its failures are marked, so a failed save can be told from a task's own refusal. */
function watched(db: Db): Db {
  const mark = <R>(call: Promise<R>): Promise<R> =>
    call.catch((error: unknown) => {
      if (typeof error === 'object' && error !== null) sqlFailures.add(error)
      throw error
    })
  return {
    execAsync: (sql) => mark(db.execAsync(sql)),
    runAsync: (sql, params) => mark(db.runAsync(sql, params)),
    getAllAsync: <R>(sql: string, params?: SqlValue[]) => mark(db.getAllAsync<R>(sql, params)),
    getFirstAsync: <R>(sql: string, params?: SqlValue[]) => mark(db.getFirstAsync<R>(sql, params)),
    withTransactionAsync: (task) => mark(db.withTransactionAsync(task)),
  }
}

/** Calls the listener after every write. Returns the way to stop. */
export function subscribeToChanges(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

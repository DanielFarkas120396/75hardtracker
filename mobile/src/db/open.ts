import * as SQLite from 'expo-sqlite'
import type { Db } from './driver'
import { migrate } from './schema'

let current: Db | null = null

/** Opens the app's database and brings it up to date. Called once, at launch. */
export async function openAppDatabase(name = 'app.db'): Promise<Db> {
  const sqlite = await SQLite.openDatabaseAsync(name, { enableChangeListener: true })
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

/** The open database. The repositories read and write through it. */
export function getDb(): Db {
  if (current === null) throw new Error('The database is not open yet.')
  return current
}

/** Tests swap in an in-memory database (see __tests__/fixtures.ts). */
export function setDbForTests(db: Db): void {
  current = db
}

/** Calls the listener after any row is added, changed or removed. Returns the way to stop. */
export function subscribeToChanges(listener: () => void): () => void {
  const subscription = SQLite.addDatabaseChangeListener(() => listener())
  return () => subscription.remove()
}

import { DatabaseSync } from 'node:sqlite'
import type { Db, SqlValue } from '../driver'
import { migrate } from '../schema'

/** A fresh in-memory database with the app's tables, for tests (Node's own SQLite, same SQL as the phone's). */
export async function freshDb(): Promise<Db> {
  const sqlite = new DatabaseSync(':memory:')
  const db: Db = {
    async execAsync(sql) {
      sqlite.exec(sql)
    },
    async runAsync(sql, params: SqlValue[] = []) {
      const result = sqlite.prepare(sql).run(...params)
      return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) }
    },
    async getAllAsync<T>(sql: string, params: SqlValue[] = []) {
      return sqlite
        .prepare(sql)
        .all(...params)
        .map((row) => ({ ...row }) as T)
    },
    async getFirstAsync<T>(sql: string, params: SqlValue[] = []) {
      const row = sqlite.prepare(sql).get(...params)
      return row === undefined ? null : ({ ...row } as T)
    },
    async withTransactionAsync(task) {
      sqlite.exec('BEGIN')
      try {
        await task()
        sqlite.exec('COMMIT')
      } catch (error) {
        sqlite.exec('ROLLBACK')
        throw error
      }
    },
  }
  await migrate(db)
  return db
}

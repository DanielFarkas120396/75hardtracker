/** A value SQLite can store. Booleans go in as 0 or 1, objects and arrays as JSON text. */
export type SqlValue = string | number | null

/**
 * The few database calls the app uses. expo-sqlite's SQLiteDatabase has this
 * shape; the tests use an in-memory database with the same shape (see
 * __tests__/testDb.ts).
 */
export interface Db {
  /** Runs one or more statements, with no parameters. */
  execAsync(sql: string): Promise<void>
  runAsync(sql: string, params?: SqlValue[]): Promise<{ lastInsertRowId: number; changes: number }>
  getAllAsync<T>(sql: string, params?: SqlValue[]): Promise<T[]>
  getFirstAsync<T>(sql: string, params?: SqlValue[]): Promise<T | null>
  /** Runs the task in a transaction, undone if the task throws. */
  withTransactionAsync(task: () => Promise<void>): Promise<void>
}

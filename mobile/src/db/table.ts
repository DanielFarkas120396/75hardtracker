import type { Db, SqlValue } from './driver'
import { ROWS, type Codec, type Row } from './rows'

/**
 * The four things the repositories do to a table, in records instead of rows.
 * They take the database as given: `getDb()` for a read, a transaction's own
 * `db` inside one.
 */

type Table = keyof typeof ROWS
type RecordOf<K extends Table> = (typeof ROWS)[K] extends Codec<infer T> ? T : never

const codecOf = <K extends Table>(table: K) => ROWS[table] as unknown as Codec<RecordOf<K>>

export async function getRow<K extends Table>(db: Db, table: K, id: number): Promise<RecordOf<K> | undefined> {
  const row = await db.getFirstAsync<Row>(`SELECT * FROM ${table} WHERE id = ?`, [id])
  return row ? codecOf(table).fromRow(row) : undefined
}

/** Every row, or those of a `WHERE …` / `ORDER BY …` clause. */
export async function allRows<K extends Table>(db: Db, table: K, clause = '', params: SqlValue[] = []): Promise<RecordOf<K>[]> {
  const rows = await db.getAllAsync<Row>(`SELECT * FROM ${table} ${clause}`, params)
  return rows.map(codecOf(table).fromRow)
}

/** Adds a record; the database numbers it. Returns its id. */
export async function insertRow<K extends Table>(db: Db, table: K, record: Omit<RecordOf<K>, 'id'>): Promise<number> {
  const codec = codecOf(table)
  return (await db.runAsync(codec.insert, codec.toParams(record))).lastInsertRowId
}

/** Changes the given fields of one record. A field given as undefined is emptied. */
export async function updateRow<K extends Table>(db: Db, table: K, id: number, changes: Partial<Omit<RecordOf<K>, 'id'>>): Promise<void> {
  const update = codecOf(table).toUpdate(id, changes)
  if (update) await db.runAsync(update.sql, update.params)
}

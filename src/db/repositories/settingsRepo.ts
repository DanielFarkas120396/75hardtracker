import { db } from '../db'

export const settingsRepo = {
  async get<T>(key: string, defaultValue: T): Promise<T> {
    const row = await db.settings.get(key)
    return row ? (row.value as T) : defaultValue
  },

  async set(key: string, value: unknown): Promise<void> {
    await db.settings.put({ key, value })
  },
}

import { getDb, transaction } from '../open'

export { DEVICE_SETTING_KEYS, SETTING_KEYS } from '@logic/settingKeys'

/** The settings table: one row per key, its value stored as JSON. Same calls as the web app's settingsRepo. */
export const settingsRepo = {
  async get<T>(key: string, defaultValue: T): Promise<T> {
    const row = await getDb().getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key])
    return row ? (JSON.parse(row.value) as T) : defaultValue
  },

  async set(key: string, value: unknown): Promise<void> {
    await transaction(async (db) => {
      await db.runAsync('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value', [
        key,
        JSON.stringify(value),
      ])
    })
  },
}

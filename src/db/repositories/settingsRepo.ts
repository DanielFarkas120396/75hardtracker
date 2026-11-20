import { db } from '../db'

export { DEVICE_SETTING_KEYS, SETTING_KEYS } from '../../logic/settingKeys'

export const settingsRepo = {
  async get<T>(key: string, defaultValue: T): Promise<T> {
    const row = await db.settings.get(key)
    return row ? (row.value as T) : defaultValue
  },

  async set(key: string, value: unknown): Promise<void> {
    await db.settings.put({ key, value })
  },
}

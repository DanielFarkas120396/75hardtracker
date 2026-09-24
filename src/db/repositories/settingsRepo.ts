import { db } from '../db'

/** Keys of the rows in the settings table. */
export const SETTING_KEYS = {
  soundEnabled: 'soundEnabled',
  hapticsEnabled: 'hapticsEnabled',
  currentBookId: 'currentBookId',
  /** ISO datetime of the last successful backup export (or of the backup that was imported). */
  lastExportAt: 'lastExportAt',
  /** Whether persistent storage has been requested once already (first launch). */
  persistRequested: 'persistRequested',
} as const

export const settingsRepo = {
  async get<T>(key: string, defaultValue: T): Promise<T> {
    const row = await db.settings.get(key)
    return row ? (row.value as T) : defaultValue
  },

  async set(key: string, value: unknown): Promise<void> {
    await db.settings.put({ key, value })
  },
}

import { db } from '../db'

/** Keys of the rows in the settings table. */
export const SETTING_KEYS = {
  soundEnabled: 'soundEnabled',
  hapticsEnabled: 'hapticsEnabled',
  currentBookId: 'currentBookId',
  /** ISO datetime of the last successful backup export (or of the backup that was imported). */
  lastExportAt: 'lastExportAt',
  /** ISO datetime until which the weekly "export a backup" reminder is snoozed ("Later"). */
  backupReminderSnoozedUntil: 'backupReminderSnoozedUntil',
  /** Whether persistent storage has been requested once already (first launch). */
  persistRequested: 'persistRequested',
  /** 'system' | 'light' | 'dark' — mirrored to localStorage for the no-flash script in index.html. */
  theme: 'theme',
  /** "HH:mm", 18:00–23:59 — the duck only turns menacing when what's left no longer fits before it. */
  bedtime: 'bedtime',
  /** The player's profile from the welcome flow — { name, why, onboardedAt }; read and write it with profileRepo. */
  profile: 'profile',
  /** The Face ID lock on this device — { credentialId, enabledAt } or absent; read and write it with appLockRepo. */
  appLock: 'appLock',
  /** ISO datetime the lock was last turned off through "Can't unlock?" (the tripwire notice), until dismissed. */
  appLockBypassedAt: 'appLockBypassedAt',
} as const

/** Settings that belong to this device, not to the data: never exported, and kept as they are on import. */
export const DEVICE_SETTING_KEYS: readonly string[] = [SETTING_KEYS.appLock, SETTING_KEYS.appLockBypassedAt]

export const settingsRepo = {
  async get<T>(key: string, defaultValue: T): Promise<T> {
    const row = await db.settings.get(key)
    return row ? (row.value as T) : defaultValue
  },

  async set(key: string, value: unknown): Promise<void> {
    await db.settings.put({ key, value })
  },
}

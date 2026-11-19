import { waitAfterFailures, type AppLockConfig, type PinFailures, type StoredPin } from '@logic/appLock'
import { SETTING_KEYS } from '@logic/settingKeys'
import { verifyPin } from '../../lock/pin'
import type { Db } from '../driver'
import { transaction } from '../open'
import { settingsRepo } from './settingsRepo'

export type { AppLockConfig, PinFailures }
export type PinResult = { ok: true } | { ok: false; failures: PinFailures }

const NO_FAILURES: PinFailures = { count: 0, lockedUntil: null }

/** Face ID needs no key on the phone: this marks it as on in the saved config's web-shaped field. */
export const FACE_ID_ON = 'local-authentication'

function isAppLockConfig(value: unknown): value is AppLockConfig {
  if (typeof value !== 'object' || value === null) return false
  const config = value as AppLockConfig
  return typeof config.credentialId === 'string' || (typeof config.pin === 'object' && config.pin !== null)
}

function put(db: Db, key: string, value: unknown) {
  return db.runAsync('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value', [key, JSON.stringify(value)])
}

async function read<T>(db: Db, key: string, fallback: T): Promise<T> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key])
  return row ? (JSON.parse(row.value) as T) : fallback
}

const asConfig = (value: unknown) => (isAppLockConfig(value) ? value : null)
const asFailures = (value: PinFailures | null) => (value && typeof value.count === 'number' ? value : NO_FAILURES)

/**
 * The app lock's settings on this phone (never in backups: see DEVICE_SETTING_KEYS). Same calls and behaviour as the
 * web app's appLockRepo; Face ID is a flag here, not a passkey's id.
 */
export const appLockRepo = {
  async get(): Promise<AppLockConfig | null> {
    return asConfig(await settingsRepo.get<unknown>(SETTING_KEYS.appLock, null))
  },

  /** Turns the lock on with a PIN (Face ID can be added after). All or nothing: a failed save leaves it off. */
  async enable(pin: StoredPin, at: string = new Date().toISOString()): Promise<void> {
    await transaction(async (db) => {
      await put(db, SETTING_KEYS.appLock, { pin, enabledAt: at } satisfies AppLockConfig)
      await put(db, SETTING_KEYS.appLockBypassedAt, null)
      await put(db, SETTING_KEYS.appLockFailures, NO_FAILURES)
    })
  },

  /** A new PIN, keeping Face ID as it was. All or nothing: a failed save keeps the old PIN. */
  async setPin(pin: StoredPin): Promise<void> {
    await transaction(async (db) => {
      const config = asConfig(await read<unknown>(db, SETTING_KEYS.appLock, null))
      await put(db, SETTING_KEYS.appLock, { ...config, enabledAt: config?.enabledAt ?? new Date().toISOString(), pin })
      await put(db, SETTING_KEYS.appLockFailures, NO_FAILURES)
    })
  },

  /** Turns Face ID unlocking on or off. */
  async setFaceId(on: boolean): Promise<void> {
    await transaction(async (db) => {
      const config = asConfig(await read<unknown>(db, SETTING_KEYS.appLock, null))
      if (!config && !on) return
      const { credentialId: _previous, ...rest } = config ?? { enabledAt: new Date().toISOString() }
      await put(db, SETTING_KEYS.appLock, on ? { ...rest, credentialId: FACE_ID_ON } : rest)
    })
  },

  async disable(): Promise<void> {
    await transaction(async (db) => {
      await put(db, SETTING_KEYS.appLock, null)
      await put(db, SETTING_KEYS.appLockFailures, NO_FAILURES)
    })
  },

  /** "Can't unlock?": turns the lock off and leaves the tripwire notice. */
  async bypass(at: string = new Date().toISOString()): Promise<void> {
    await transaction(async (db) => {
      await put(db, SETTING_KEYS.appLock, null)
      await put(db, SETTING_KEYS.appLockBypassedAt, at)
      await put(db, SETTING_KEYS.appLockFailures, NO_FAILURES)
    })
  },

  async getBypassedAt(): Promise<string | null> {
    const value = await settingsRepo.get<unknown>(SETTING_KEYS.appLockBypassedAt, null)
    return typeof value === 'string' ? value : null
  },

  async dismissBypassNotice(): Promise<void> {
    await settingsRepo.set(SETTING_KEYS.appLockBypassedAt, null)
  },

  /** Wrong PINs so far, kept across launches so closing the app doesn't reset the wait. */
  async getFailures(): Promise<PinFailures> {
    return asFailures(await settingsRepo.get<PinFailures | null>(SETTING_KEYS.appLockFailures, null))
  },

  async resetFailures(): Promise<void> {
    await settingsRepo.set(SETTING_KEYS.appLockFailures, NO_FAILURES)
  },

  /**
   * Checks a PIN against the lock's, counting wrong ones, on the lock screen and in Settings alike, so the PIN can't
   * be guessed anywhere for free. During a wait, no PIN is even checked. The slow derivation runs outside the write.
   */
  async checkPin(pin: string, now: number = Date.now()): Promise<PinResult> {
    const current = await this.getFailures()
    if (current.lockedUntil !== null && current.lockedUntil > now) return { ok: false, failures: current }
    const config = await this.get()
    if (config?.pin && (await verifyPin(pin, config.pin))) {
      await this.resetFailures()
      return { ok: true }
    }
    return transaction(async (db) => {
      const { count } = asFailures(await read<PinFailures | null>(db, SETTING_KEYS.appLockFailures, null))
      const wait = waitAfterFailures(count + 1)
      const failures = { count: count + 1, lockedUntil: wait > 0 ? now + wait : null }
      await put(db, SETTING_KEYS.appLockFailures, failures)
      return { ok: false, failures } as const
    })
  },
}

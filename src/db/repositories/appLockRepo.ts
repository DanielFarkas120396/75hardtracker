import { verifyPin, waitAfterFailures, type StoredPin } from '../../lib/pin'
import { db } from '../db'
import { SETTING_KEYS, settingsRepo } from './settingsRepo'

export interface AppLockConfig {
  /** The PIN's fingerprint (see src/lib/pin.ts). The lock's base: Face ID is the shortcut. */
  pin?: StoredPin
  /** The Face ID passkey's credential id (base64url), when "Also unlock with Face ID" is on. */
  credentialId?: string
  enabledAt: string
}

export interface PinFailures {
  /** Wrong PINs in a row. */
  count: number
  /** Epoch ms until which no PIN is accepted, or null. */
  lockedUntil: number | null
}

export type PinResult = { ok: true } | { ok: false; failures: PinFailures }

const NO_FAILURES: PinFailures = { count: 0, lockedUntil: null }

function isAppLockConfig(value: unknown): value is AppLockConfig {
  if (typeof value !== 'object' || value === null) return false
  const config = value as AppLockConfig
  return typeof config.credentialId === 'string' || (typeof config.pin === 'object' && config.pin !== null)
}

/** The app lock's settings on this device (never in backups: see DEVICE_SETTING_KEYS). */
export const appLockRepo = {
  async get(): Promise<AppLockConfig | null> {
    const value = await settingsRepo.get<unknown>(SETTING_KEYS.appLock, null)
    return isAppLockConfig(value) ? value : null
  },

  /** Turns the lock on with a PIN (Face ID can be added after). All or nothing: a failed save leaves it off. */
  async enable(pin: StoredPin, at: string = new Date().toISOString()): Promise<void> {
    await db.transaction('rw', db.settings, async () => {
      await settingsRepo.set(SETTING_KEYS.appLock, { pin, enabledAt: at } satisfies AppLockConfig)
      await settingsRepo.set(SETTING_KEYS.appLockBypassedAt, null)
      await this.resetFailures()
    })
  },

  /** All or nothing: a failed save keeps the old PIN. */
  async setPin(pin: StoredPin): Promise<void> {
    await db.transaction('rw', db.settings, async () => {
      const config = await this.get()
      await settingsRepo.set(SETTING_KEYS.appLock, { ...config, enabledAt: config?.enabledAt ?? new Date().toISOString(), pin })
      await this.resetFailures()
    })
  },

  /** Adds (credential id) or removes (null) Face ID unlocking. */
  async setFaceId(credentialId: string | null): Promise<void> {
    const config = await this.get()
    if (!config && credentialId === null) return
    const { credentialId: _previous, ...rest } = config ?? { enabledAt: new Date().toISOString() }
    await settingsRepo.set(SETTING_KEYS.appLock, credentialId ? { ...rest, credentialId } : rest)
  },

  async disable(): Promise<void> {
    await settingsRepo.set(SETTING_KEYS.appLock, null)
    await this.resetFailures()
  },

  /** "Can't unlock?": turns the lock off and leaves the tripwire notice. */
  async bypass(at: string = new Date().toISOString()): Promise<void> {
    await settingsRepo.set(SETTING_KEYS.appLock, null)
    await settingsRepo.set(SETTING_KEYS.appLockBypassedAt, at)
    await this.resetFailures()
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
    const value = await settingsRepo.get<PinFailures | null>(SETTING_KEYS.appLockFailures, null)
    return value && typeof value.count === 'number' ? value : NO_FAILURES
  },

  async recordFailure(now: number = Date.now()): Promise<PinFailures> {
    const { count } = await this.getFailures()
    const wait = waitAfterFailures(count + 1)
    const failures = { count: count + 1, lockedUntil: wait > 0 ? now + wait : null }
    await settingsRepo.set(SETTING_KEYS.appLockFailures, failures)
    return failures
  },

  async resetFailures(): Promise<void> {
    await settingsRepo.set(SETTING_KEYS.appLockFailures, NO_FAILURES)
  },

  /**
   * Checks a PIN against the lock's, counting wrong ones — on the lock screen
   * and in Settings alike, so the PIN can't be guessed anywhere for free.
   * During a wait, no PIN is even checked.
   */
  async checkPin(pin: string, now: number = Date.now()): Promise<PinResult> {
    const current = await this.getFailures()
    if (current.lockedUntil !== null && current.lockedUntil > now) return { ok: false, failures: current }
    const config = await this.get()
    if (config?.pin && (await verifyPin(pin, config.pin))) {
      await this.resetFailures()
      return { ok: true }
    }
    return { ok: false, failures: await this.recordFailure(now) }
  },
}

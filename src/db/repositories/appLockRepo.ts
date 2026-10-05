import { SETTING_KEYS, settingsRepo } from './settingsRepo'

export interface AppLockConfig {
  /** The lock passkey's credential id (base64url). */
  credentialId: string
  enabledAt: string
}

function isAppLockConfig(value: unknown): value is AppLockConfig {
  return typeof value === 'object' && value !== null && typeof (value as AppLockConfig).credentialId === 'string'
}

/** The Face ID lock's settings on this device (never in backups: see DEVICE_SETTING_KEYS). */
export const appLockRepo = {
  async get(): Promise<AppLockConfig | null> {
    const value = await settingsRepo.get<unknown>(SETTING_KEYS.appLock, null)
    return isAppLockConfig(value) ? value : null
  },

  async enable(credentialId: string, at: string = new Date().toISOString()): Promise<void> {
    await settingsRepo.set(SETTING_KEYS.appLock, { credentialId, enabledAt: at } satisfies AppLockConfig)
    await settingsRepo.set(SETTING_KEYS.appLockBypassedAt, null)
  },

  async disable(): Promise<void> {
    await settingsRepo.set(SETTING_KEYS.appLock, null)
  },

  /** "Can't unlock?": turns the lock off and leaves the tripwire notice. */
  async bypass(at: string = new Date().toISOString()): Promise<void> {
    await settingsRepo.set(SETTING_KEYS.appLock, null)
    await settingsRepo.set(SETTING_KEYS.appLockBypassedAt, at)
  },

  async getBypassedAt(): Promise<string | null> {
    const value = await settingsRepo.get<unknown>(SETTING_KEYS.appLockBypassedAt, null)
    return typeof value === 'string' ? value : null
  },

  async dismissBypassNotice(): Promise<void> {
    await settingsRepo.set(SETTING_KEYS.appLockBypassedAt, null)
  },
}

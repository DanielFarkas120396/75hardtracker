import { useLiveQuery } from 'dexie-react-hooks'
import { SETTING_KEYS, settingsRepo } from '../db/repositories/settingsRepo'

/** App-wide sound/haptics preferences, persisted in Dexie's settings table. Both default to on. */
export function useSettings() {
  const soundEnabled = useLiveQuery(() => settingsRepo.get(SETTING_KEYS.soundEnabled, true), []) ?? true
  const hapticsEnabled = useLiveQuery(() => settingsRepo.get(SETTING_KEYS.hapticsEnabled, true), []) ?? true

  return {
    soundEnabled,
    hapticsEnabled,
    setSoundEnabled: (value: boolean) => settingsRepo.set(SETTING_KEYS.soundEnabled, value),
    setHapticsEnabled: (value: boolean) => settingsRepo.set(SETTING_KEYS.hapticsEnabled, value),
  }
}

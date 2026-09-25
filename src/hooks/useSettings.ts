import { useLiveQuery } from 'dexie-react-hooks'
import { SETTING_KEYS, settingsRepo } from '../db/repositories/settingsRepo'
import { bedtimeMinutes, DEFAULT_BEDTIME, formatHHmm, isValidBedtime } from '../logic/menace'

/** App-wide preferences, persisted in Dexie's settings table: sound and haptics (both default on) and the bedtime. */
export function useSettings() {
  const soundEnabled = useLiveQuery(() => settingsRepo.get(SETTING_KEYS.soundEnabled, true), []) ?? true
  const hapticsEnabled = useLiveQuery(() => settingsRepo.get(SETTING_KEYS.hapticsEnabled, true), []) ?? true
  const storedBedtime = useLiveQuery(() => settingsRepo.get<unknown>(SETTING_KEYS.bedtime, DEFAULT_BEDTIME), [])
  const bedtime = formatHHmm(bedtimeMinutes(storedBedtime ?? DEFAULT_BEDTIME))

  return {
    soundEnabled,
    hapticsEnabled,
    bedtime,
    setSoundEnabled: (value: boolean) => settingsRepo.set(SETTING_KEYS.soundEnabled, value),
    setHapticsEnabled: (value: boolean) => settingsRepo.set(SETTING_KEYS.hapticsEnabled, value),
    /** Saves an "HH:mm" bedtime; values outside 18:00–23:59 are ignored. */
    setBedtime: async (value: string) => {
      if (isValidBedtime(value)) await settingsRepo.set(SETTING_KEYS.bedtime, value)
    },
  }
}

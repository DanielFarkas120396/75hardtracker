import { useLiveQuery } from 'dexie-react-hooks'
import { SETTING_KEYS, settingsRepo } from '../db/repositories/settingsRepo'
import { bedtimeMinutes, DEFAULT_BEDTIME, formatHHmm, isValidBedtime } from '../logic/menace'

/** App-wide preferences, persisted in Dexie's settings table: sound and haptics (both default on) and the bedtime. */
export function useSettings() {
  const soundEnabled = useLiveQuery(() => settingsRepo.get(SETTING_KEYS.soundEnabled, true), []) ?? true
  const hapticsEnabled = useLiveQuery(() => settingsRepo.get(SETTING_KEYS.hapticsEnabled, true), []) ?? true
  // Mapped so a resolved query is never `undefined`: a settings row can have
  // no `value` (import validation only checks `key`), which would otherwise
  // read back as `undefined` and be indistinguishable from "still loading".
  const storedBedtime = useLiveQuery(
    () => settingsRepo.get<unknown>(SETTING_KEYS.bedtime, DEFAULT_BEDTIME).then((value) => value ?? DEFAULT_BEDTIME),
    [],
  )
  const bedtime = formatHHmm(bedtimeMinutes(storedBedtime ?? DEFAULT_BEDTIME))

  return {
    soundEnabled,
    hapticsEnabled,
    bedtime,
    /** True once the stored bedtime has been read at least once; false only on the very first render. */
    bedtimeLoaded: storedBedtime !== undefined,
    setSoundEnabled: (value: boolean) => settingsRepo.set(SETTING_KEYS.soundEnabled, value),
    setHapticsEnabled: (value: boolean) => settingsRepo.set(SETTING_KEYS.hapticsEnabled, value),
    /** Saves an "HH:mm" bedtime; values outside 18:00–23:59 are ignored. */
    setBedtime: async (value: string) => {
      if (isValidBedtime(value)) await settingsRepo.set(SETTING_KEYS.bedtime, value)
    },
  }
}

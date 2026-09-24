import { useLiveQuery } from 'dexie-react-hooks'
import { settingsRepo } from '../db/repositories/settingsRepo'

const SOUND_KEY = 'soundEnabled'
const HAPTICS_KEY = 'hapticsEnabled'

/** App-wide sound/haptics preferences, persisted in Dexie's settings table. Both default to on. */
export function useSettings() {
  const soundEnabled = useLiveQuery(() => settingsRepo.get(SOUND_KEY, true), []) ?? true
  const hapticsEnabled = useLiveQuery(() => settingsRepo.get(HAPTICS_KEY, true), []) ?? true

  return {
    soundEnabled,
    hapticsEnabled,
    setSoundEnabled: (value: boolean) => settingsRepo.set(SOUND_KEY, value),
    setHapticsEnabled: (value: boolean) => settingsRepo.set(HAPTICS_KEY, value),
  }
}

import { SETTING_KEYS } from '@logic/settingKeys'
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio'
import { useEffect } from 'react'
import { settingsRepo } from '../db/repositories/settingsRepo'
import { useLiveQuery } from '../db/useLiveQuery'

// Rendered by scripts/render-sounds.mjs from the web's synthesis (src/lib/sound.ts).
// oxlint-disable-next-line typescript/no-require-imports
const KNIFE_SHING: number = require('../../assets/sounds/knife-shing.wav')
// oxlint-disable-next-line typescript/no-require-imports
const DAY_COMPLETE: number = require('../../assets/sounds/day-complete.wav')

/**
 * Plays one of the app's sounds, if the player hasn't turned sounds off (they are on by default). It stays quiet
 * when the phone is on silent, and plays over the player's own music instead of stopping it.
 */
function useSoundFile(file: number): () => void {
  const soundEnabled = useLiveQuery(() => settingsRepo.get<boolean>(SETTING_KEYS.soundEnabled, true), []) ?? true
  const player = useAudioPlayer(file)
  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: false }).catch(() => undefined)
  }, [])

  return () => {
    if (!soundEnabled) return
    // From the start each time: a second one cuts the first one's ring short.
    void player.seekTo(0).catch(() => undefined)
    player.play()
  }
}

/** The duck's knife "shing". The web's useKnifeSound. */
export const useKnifeSound = () => useSoundFile(KNIFE_SHING)

/** The two-note chime of a day complete. The web's useSound. */
export const useChime = () => useSoundFile(DAY_COMPLETE)

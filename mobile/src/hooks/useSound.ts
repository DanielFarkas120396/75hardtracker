import { SETTING_KEYS } from '@logic/settingKeys'
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio'
import { useEffect } from 'react'
import { settingsRepo } from '../db/repositories/settingsRepo'
import { useLiveQuery } from '../db/useLiveQuery'

// Rendered by scripts/render-sounds.mjs from the web's synthesis (src/lib/sound.ts).
// oxlint-disable-next-line typescript/no-require-imports
const KNIFE_SHING: number = require('../../assets/sounds/knife-shing.wav')

/**
 * Plays the duck's knife "shing", if the player hasn't turned sounds off
 * (they are on by default). It stays quiet when the phone is on silent, and
 * plays over the player's own music instead of stopping it. The web's useKnifeSound.
 */
export function useKnifeSound(): () => void {
  const soundEnabled = useLiveQuery(() => settingsRepo.get<boolean>(SETTING_KEYS.soundEnabled, true), []) ?? true
  const player = useAudioPlayer(KNIFE_SHING)
  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: false }).catch(() => undefined)
  }, [])

  return () => {
    if (!soundEnabled) return
    // From the start each time: a second poke cuts the first one's ring short.
    void player.seekTo(0).catch(() => undefined)
    player.play()
  }
}

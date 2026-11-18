import { SETTING_KEYS } from '@logic/settingKeys'
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio'
import { useEffect, useRef } from 'react'
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
  // Undefined until the setting has been read.
  const soundEnabled = useLiveQuery(() => settingsRepo.get<boolean>(SETTING_KEYS.soundEnabled, true), [])
  const player = useAudioPlayer(file)
  // Asked for before the setting was known (the app opening on Victory): it rings once it is, if sounds are on.
  const waiting = useRef(false)
  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: false }).catch(() => undefined)
  }, [])

  const ring = () => {
    // From the start each time: a second one cuts the first one's ring short.
    void player.seekTo(0).catch(() => undefined)
    player.play()
  }
  useEffect(() => {
    if (soundEnabled === undefined || !waiting.current) return
    waiting.current = false
    if (soundEnabled) ring()
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- rings when the setting arrives, not when the player's identity changes
  }, [soundEnabled])

  return () => {
    if (soundEnabled === undefined) waiting.current = true
    else if (soundEnabled) ring()
  }
}

/** The duck's knife "shing". The web's useKnifeSound. */
export const useKnifeSound = () => useSoundFile(KNIFE_SHING)

/** The two-note chime of a day complete. The web's useSound. */
export const useChime = () => useSoundFile(DAY_COMPLETE)

import { useCallback } from 'react'
import { playChime } from '../lib/sound'
import { useSettings } from './useSettings'

/** Plays the success chime, gated by the user's sound setting. */
export function useSound() {
  const { soundEnabled } = useSettings()

  return useCallback(() => {
    if (soundEnabled) playChime()
  }, [soundEnabled])
}

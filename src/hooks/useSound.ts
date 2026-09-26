import { useCallback } from 'react'
import { playChime, playKnifeShing } from '../lib/sound'
import { useSettings } from './useSettings'

/** Plays the success chime, gated by the user's sound setting. */
export function useSound() {
  const { soundEnabled } = useSettings()

  return useCallback(() => {
    if (soundEnabled) playChime()
  }, [soundEnabled])
}

/** Plays the duck's knife "shing", gated by the user's sound setting. */
export function useKnifeSound() {
  const { soundEnabled } = useSettings()

  return useCallback(() => {
    if (soundEnabled) playKnifeShing()
  }, [soundEnabled])
}

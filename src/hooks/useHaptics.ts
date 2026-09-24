import { useCallback } from 'react'
import { useSettings } from './useSettings'

/** Triggers a short vibration pattern, gated by the user's haptics setting and device support. */
export function useHaptics() {
  const { hapticsEnabled } = useSettings()

  return useCallback(
    (pattern: number | number[] = 40) => {
      if (hapticsEnabled && typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(pattern)
      }
    },
    [hapticsEnabled],
  )
}

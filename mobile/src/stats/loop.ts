import { useFrameCallback, useSharedValue, type SharedValue } from 'react-native-reanimated'
import { useReduceMotion } from '../hooks/useReduceMotion'

/**
 * Seconds since the drawing appeared, on the UI thread, for the Stats drawings' endless loops (the web's CSS
 * animations): each element reads its own phase from it. It stands still at 0 under Reduce Motion.
 */
export function useLoopClock(): SharedValue<number> {
  const reduceMotion = useReduceMotion()
  const seconds = useSharedValue(0)
  useFrameCallback((frame) => {
    seconds.value = frame.timeSinceFirstFrame / 1000
  }, !reduceMotion)
  return seconds
}

/** Where a loop of `duration` seconds is at `seconds`, 0 to 1, shifted by `delay` seconds (the web's negative delays). */
export function phase(seconds: number, duration: number, delay = 0): number {
  'worklet'
  const p = ((seconds + delay) / duration) % 1
  return p < 0 ? p + 1 : p
}

/** An opacity that fades in over the first fifth, holds, and fades out by the end (`holdUntil`): the dust and the sparks. */
export function fadeInOut(p: number, peak: number, holdUntil: number): number {
  'worklet'
  if (p < 0.2) return (p / 0.2) * peak
  if (p <= holdUntil) return peak
  return peak * (1 - (p - holdUntil) / (1 - holdUntil))
}

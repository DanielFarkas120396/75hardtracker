import { useContext, useEffect } from 'react'
import { useFrameCallback, useSharedValue, type SharedValue } from 'react-native-reanimated'
import { useReduceMotion } from '../hooks/useReduceMotion'
import { ScreenFocusContext } from '../today/TaskBoard'

/**
 * Seconds of looping, on the UI thread, for the Stats drawings' endless loops (the web's CSS animations): each element
 * reads its own phase from it. It runs only while its tab is in front and motion is allowed, and goes back to 0 (the
 * still frame) under Reduce Motion.
 */
export function useLoopClock(): SharedValue<number> {
  const reduceMotion = useReduceMotion()
  const focused = useContext(ScreenFocusContext)
  const seconds = useSharedValue(0)
  // Reanimated reads the start flag once: the effect starts and stops it.
  const frames = useFrameCallback((frame) => {
    if (frame.timeSincePreviousFrame !== null) seconds.value += frame.timeSincePreviousFrame / 1000
  }, false)
  const running = focused && !reduceMotion
  useEffect(() => {
    frames.setActive(running)
    if (reduceMotion) seconds.set(0)
  }, [frames, running, reduceMotion, seconds])
  return seconds
}

/** The `matrix` that slides by `dx` along x: react-native-svg's native side takes only matrices, not translateX. */
export function translateX(dx: number): number[] {
  'worklet'
  return [1, 0, 0, 1, dx, 0]
}

/** The `matrix` that turns by `degrees` about (cx, cy). */
export function rotateAbout(degrees: number, cx: number, cy: number): number[] {
  'worklet'
  const r = (degrees * Math.PI) / 180
  const cos = Math.cos(r)
  const sin = Math.sin(r)
  return [cos, sin, -sin, cos, cx - cos * cx + sin * cy, cy - sin * cx - cos * cy]
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

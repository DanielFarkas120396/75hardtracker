import { useSyncExternalStore } from 'react'
import { AccessibilityInfo } from 'react-native'

// One answer for the whole app: asked when the first screen listens (AppGate, at launch) and kept current, so a
// screen that appears later knows it on its very first render. A hook that asked for itself would say "motion
// allowed" for a moment, and an animation started on that render would be cut short and left half way.
let reduced = false
let stop: (() => void) | null = null
const listeners = new Set<() => void>()

function set(value: boolean) {
  if (reduced === value) return
  reduced = value
  for (const listener of [...listeners]) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (stop === null) {
    let gone = false
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (!gone) set(value)
    })
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      if (!gone) set(value)
    })
    stop = () => {
      gone = true
      subscription.remove()
    }
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size > 0 || stop === null) return
    // Nobody listens any more: the next one asks afresh.
    stop()
    stop = null
    reduced = false
  }
}

/** Whether the phone's "Reduce Motion" setting is on. False until the phone has answered, once, at launch. */
export function useReduceMotion(): boolean {
  return useSyncExternalStore(subscribe, () => reduced)
}

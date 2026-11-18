import { useEffect, useState } from 'react'
import { AccessibilityInfo } from 'react-native'

/** Whether the phone's "Reduce Motion" setting is on. False until the phone has answered. */
export function useReduceMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    let gone = false
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (!gone) setReduced(value)
    })
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced)
    return () => {
      gone = true
      subscription.remove()
    }
  }, [])
  return reduced
}

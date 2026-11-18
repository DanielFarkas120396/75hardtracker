import { useEffect, useRef } from 'react'
import { AccessibilityInfo } from 'react-native'

/**
 * Says a line aloud each time it changes, for VoiceOver: the iPhone has no
 * live regions (the web's aria-live), so a line that changes on screen stays
 * silent unless it is announced. The line as it first appears is not read:
 * the screen's title is.
 */
export function useAnnounceChanges(line: string): void {
  const previous = useRef(line)
  useEffect(() => {
    if (previous.current !== line && line !== '') AccessibilityInfo.announceForAccessibility(line)
    previous.current = line
  }, [line])
}

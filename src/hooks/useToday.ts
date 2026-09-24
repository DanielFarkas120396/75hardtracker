import { useSyncExternalStore } from 'react'
import { msUntilNextLocalMidnight, todayISO } from '../lib/dates'

/** A second of slack so the timer never fires just before midnight. */
const MIDNIGHT_SLACK_MS = 1000

function subscribe(onChange: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined

  const armMidnightTimer = () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      onChange()
      armMidnightTimer()
    }, msUntilNextLocalMidnight() + MIDNIGHT_SLACK_MS)
  }

  // Timers are throttled or frozen while the tab is hidden or the phone
  // sleeps, so re-check (and re-arm) whenever the app comes back.
  const onWake = () => {
    onChange()
    armMidnightTimer()
  }

  armMidnightTimer()
  document.addEventListener('visibilitychange', onWake)
  window.addEventListener('focus', onWake)
  window.addEventListener('pageshow', onWake)

  return () => {
    clearTimeout(timer)
    document.removeEventListener('visibilitychange', onWake)
    window.removeEventListener('focus', onWake)
    window.removeEventListener('pageshow', onWake)
  }
}

/**
 * Today's local date (yyyy-MM-dd), rolling over at local midnight even while
 * the app stays open, and re-checked whenever the app regains focus.
 */
export function useToday(): string {
  return useSyncExternalStore(subscribe, () => todayISO())
}

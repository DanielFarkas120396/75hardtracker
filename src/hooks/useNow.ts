import { useSyncExternalStore } from 'react'
import { parseHHmm } from '../logic/menace'

const TICK_MS = 30_000

/** Dev only: `?now=HH:mm` freezes the clock, to see every menace level. Production builds ignore it. */
function devOverride(): number | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null
  const value = new URLSearchParams(window.location.search).get('now')
  return value ? parseHHmm(value) : null
}

function currentMinutes(): number {
  const override = devOverride()
  if (override !== null) return override
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

function subscribe(onChange: () => void): () => void {
  const timer = setInterval(onChange, TICK_MS)
  // Timers are throttled or frozen while the app is hidden or the phone sleeps.
  document.addEventListener('visibilitychange', onChange)
  window.addEventListener('focus', onChange)
  window.addEventListener('pageshow', onChange)
  return () => {
    clearInterval(timer)
    document.removeEventListener('visibilitychange', onChange)
    window.removeEventListener('focus', onChange)
    window.removeEventListener('pageshow', onChange)
  }
}

/** Minutes since local midnight, kept current while the app is open. */
export function useNow(): number {
  return useSyncExternalStore(subscribe, currentMinutes)
}

import { useSyncExternalStore } from 'react'

function subscribe(onChange: () => void): () => void {
  const timer = setInterval(onChange, 1000)
  return () => clearInterval(timer)
}

/** Whole seconds left until `until` (epoch ms), ticking every second; 0 once it's passed or when there's none. */
export function useCountdown(until: number | null): number {
  return useSyncExternalStore(subscribe, () => (until === null ? 0 : Math.max(0, Math.ceil((until - Date.now()) / 1000))))
}

export { formatCountdown } from '../logic/appLock'

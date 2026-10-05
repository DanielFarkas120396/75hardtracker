import { useSyncExternalStore } from 'react'

function subscribe(onChange: () => void): () => void {
  const timer = setInterval(onChange, 1000)
  return () => clearInterval(timer)
}

/** Whole seconds left until `until` (epoch ms), ticking every second; 0 once it's passed or when there's none. */
export function useCountdown(until: number | null): number {
  return useSyncExternalStore(subscribe, () => (until === null ? 0 : Math.max(0, Math.ceil((until - Date.now()) / 1000))))
}

/** "0:27", "4:05", "1:00:00". */
export function formatCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = String(seconds % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

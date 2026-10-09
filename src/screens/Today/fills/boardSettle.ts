import { useEffect, useState, useSyncExternalStore } from 'react'

let busy = false
const listeners = new Set<() => void>()

/** The board still has a done task on its way to its chip (set by TaskBoard). */
export function setBoardBusy(value: boolean): void {
  if (busy === value) return
  busy = value
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useBoardBusy(): boolean {
  return useSyncExternalStore(subscribe, () => busy)
}

/** A celebration that waits for the board's last chip to land, `maxWaitMs` at most. */
export function useSettledCelebration<T>(value: T | null, maxWaitMs = 4000): T | null {
  const boardBusy = useBoardBusy()
  const [timedOut, setTimedOut] = useState<T | null>(null)
  // A new value shows one commit late: the board learns of the last task in the same commit as us, and says it's busy
  // in its effects, which run before ours. Without the wait the overlay would flash, its confetti firing twice.
  const [seen, setSeen] = useState<T | null>(null)
  // oxlint-disable-next-line react/set-state-in-effect -- the extra render is the point
  useEffect(() => setSeen(value), [value])
  useEffect(() => {
    if (value === null || !boardBusy) return
    const timer = setTimeout(() => setTimedOut(value), maxWaitMs)
    return () => clearTimeout(timer)
  }, [value, boardBusy, maxWaitMs])
  return value !== null && seen === value && (!boardBusy || timedOut === value) ? value : null
}

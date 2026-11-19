import { useSyncExternalStore } from 'react'

// The Gallery's "Take today's photo": Today opens its camera once for that day, then the request is spent (the web's
// cameraRequested in App.tsx). Keyed by date, so a request made before Day 1 never opens the camera weeks later.
let requested: string | null = null
const listeners = new Set<() => void>()

function set(value: string | null) {
  requested = value
  for (const listener of [...listeners]) listener()
}

/** Asks Today to open its camera for the day `date`. */
export function requestCamera(date: string): void {
  set(date)
}

/** Whether the camera was asked for on `date`; reading it spends a request for that date and drops any other. */
export function takeCameraRequest(date: string): boolean {
  const asked = requested === date
  if (requested !== null) set(null)
  return asked
}

/** The pending request's date, or null. */
export function useCameraRequest(): string | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => requested,
  )
}

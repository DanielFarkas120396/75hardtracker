import { useSyncExternalStore } from 'react'

// Whether the app lock is closed right now, for the parts drawn outside the lock's own tree: the toasts (badges stay
// hidden under the lock) and every Modal (none may sit above the lock screen).

export type LockStatus = 'loading' | 'locked' | 'open'

let status: LockStatus = 'open'
const listeners = new Set<() => void>()

export function setLockStatus(next: LockStatus): void {
  if (next === status) return
  status = next
  for (const listener of [...listeners]) listener()
}

export function useLockStatus(): LockStatus {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    () => status,
  )
}

/** A Modal's `visible`: hidden while the lock is closed (it comes back once unlocked), as nothing native may cover the lock. */
export function useCurtained(visible: boolean): boolean {
  const locked = useLockStatus() === 'locked'
  return visible && !locked
}

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

let coverShown = false

/** The app-switcher cover is up: badges wait under it too. */
export function setCoverShown(next: boolean): void {
  if (next === coverShown) return
  coverShown = next
  for (const listener of [...listeners]) listener()
}

export function useCoverShown(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    () => coverShown,
  )
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

/** A Modal's `visible`: hidden unless the lock is open (it comes back once unlocked), as nothing native may cover the lock. */
export function useCurtained(visible: boolean): boolean {
  // Loading counts as closed: a Modal mounted open at a locked launch never flashes over the lock.
  const open = useLockStatus() === 'open'
  return visible && open
}

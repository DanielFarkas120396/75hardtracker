import type { BadgeDefinition } from '@logic/badges'
import { useSyncExternalStore } from 'react'

// The app's toasts, as one small store: the badges waiting to be shown (queued by the tabs' layout) and how many
// saves failed (counted by transaction()). The web keeps the same two in App.tsx.

interface ToastState {
  badges: readonly BadgeDefinition[]
  /** Grows with each failed save, so a repeat can restart the toast's timer; 0 once dismissed. */
  saveFailures: number
  /** A covering screen is up (the peak, an ending, the camera): badges wait, as on the web. */
  badgesPaused: boolean
}

let state: ToastState = { badges: [], saveFailures: 0, badgesPaused: false }
const listeners = new Set<() => void>()

function update(next: Partial<ToastState>): void {
  state = { ...state, ...next }
  for (const listener of [...listeners]) listener()
}

export function queueBadges(badges: readonly BadgeDefinition[]): void {
  const fresh = badges.filter((badge) => !state.badges.some((queued) => queued.id === badge.id))
  if (fresh.length > 0) update({ badges: [...state.badges, ...fresh] })
}

export function dismissBadge(badgeId: string): void {
  update({ badges: state.badges.filter((badge) => badge.id !== badgeId) })
}

export function noteSaveFailure(): void {
  update({ saveFailures: state.saveFailures + 1 })
}

export function dismissSaveFailure(): void {
  update({ saveFailures: 0 })
}

export function setBadgesPaused(paused: boolean): void {
  if (paused !== state.badgesPaused) update({ badgesPaused: paused })
}

/** Back to nothing queued, for tests. */
export function resetToastsForTests(): void {
  state = { badges: [], saveFailures: 0, badgesPaused: false }
}

export function useToastState(): ToastState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    () => state,
  )
}

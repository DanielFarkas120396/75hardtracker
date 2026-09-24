import { db } from './db'

export interface OpenDatabaseCallbacks {
  /** Another tab still has an older version open, which blocks the upgrade. */
  onBlocked?: () => void
  /** Opening is taking suspiciously long (e.g. a stuck upgrade). */
  onSlow?: () => void
}

const SLOW_OPEN_MS = 8000

/**
 * Opens the database before the app renders, so failures (private
 * browsing, storage disabled, quota) surface as a readable screen instead
 * of an endless "Loading…".
 */
export async function openDatabase(callbacks: OpenDatabaseCallbacks = {}): Promise<void> {
  db.on('blocked', () => callbacks.onBlocked?.())
  // A newer version of the app opened the database in another tab (after an
  // update): Dexie closes this connection, so reload onto the new code.
  db.on('versionchange', () => {
    window.location.reload()
  })

  const slowTimer = setTimeout(() => callbacks.onSlow?.(), SLOW_OPEN_MS)
  try {
    await db.open()
  } finally {
    clearTimeout(slowTimer)
  }
}

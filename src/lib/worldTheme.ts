import { worldForDay, type WorldId } from '../screens/Journey/worlds'
import { syncThemeColor } from './theme'

/**
 * localStorage mirror of the current world, so the inline script in
 * index.html can colour the app before the first paint. Keep it in sync with that script.
 */
export const WORLD_STORAGE_KEY = '75hard-world'

/**
 * The world whose colours the app wears: the one the current attempt's day is
 * in. Before the start, with no attempt or with a broken start date, that's
 * hell (the bottom of the climb); after victory, heaven.
 */
export function worldForProgress(todayDayNumber: number | null, completed: boolean): WorldId {
  if (completed) return 'heaven'
  if (todayDayNumber === null || !Number.isFinite(todayDayNumber) || todayDayNumber < 1) return 'hell'
  return worldForDay(todayDayNumber).id
}

/** Sets the world on <html> (its CSS tokens follow), remembers it and repaints the browser chrome. */
export function applyWorld(world: WorldId): void {
  document.documentElement.dataset.world = world
  try {
    localStorage.setItem(WORLD_STORAGE_KEY, world)
  } catch {
    // Storage can be unavailable (private mode, blocked site data); the world still applies this session.
  }
  syncThemeColor()
}

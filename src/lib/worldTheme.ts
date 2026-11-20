import type { WorldId } from '../logic/worlds'
import { syncThemeColor } from './theme'

export { worldForProgress } from '../logic/worlds'

/**
 * localStorage mirror of the current world, so the inline script in
 * index.html can colour the app before the first paint. Keep it in sync with that script.
 */
export const WORLD_STORAGE_KEY = '75hard-world'

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

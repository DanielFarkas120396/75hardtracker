/**
 * Where fingers are, for the ducks on screen: a screen tells it of each touch
 * and of its scrolling, and every duck looks there (the web's useTouchGaze,
 * which listens to the whole window; a phone screen has no such listener).
 */
interface Watcher {
  /** A finger touched or moved at this point of the window. */
  touch(pageX: number, pageY: number): void
  /** The page scrolled. */
  scrolled(): void
}

const watchers = new Set<Watcher>()

/**
 * A point of the window in the duck's own units, given where his drawing is on
 * screen. His art runs from (-10, 20) over 490 by 500 (DUCK_VIEWBOX).
 */
export function artPoint(pageX: number, pageY: number, box: { left: number; top: number; width: number; height: number }): { x: number; y: number } {
  return { x: -10 + ((pageX - box.left) / box.width) * 490, y: 20 + ((pageY - box.top) / box.height) * 500 }
}

export const gaze = {
  touch(pageX: number, pageY: number): void {
    for (const watcher of watchers) watcher.touch(pageX, pageY)
  },
  scrolled(): void {
    for (const watcher of watchers) watcher.scrolled()
  },
  /** A duck starts watching. Returns the way to stop. */
  watch(watcher: Watcher): () => void {
    watchers.add(watcher)
    return () => {
      watchers.delete(watcher)
    }
  },
}

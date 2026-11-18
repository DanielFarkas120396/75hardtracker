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

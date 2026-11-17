/** The time-lapse lasts about this long, whatever the number of photos. */
const TIMELAPSE_MS = 4000
const MIN_FRAME_MS = 80
const MAX_FRAME_MS = 400

interface ComparablePhoto {
  dayNumber: number
  photo: { id: number }
}

/**
 * The two photos the slider shows, earlier day first. `oldestFirst` holds at
 * least two photos. A picked photo that's gone falls back to the first (or
 * the latest) photo, and the same photo is never shown on both sides.
 */
export function comparePair<T extends ComparablePhoto>(oldestFirst: readonly T[], earlierId?: number, laterId?: number): [T, T] {
  const first = oldestFirst[0]
  const latest = oldestFirst[oldestFirst.length - 1]
  const a = oldestFirst.find((e) => e.photo.id === earlierId) ?? first
  const b = oldestFirst.find((e) => e.photo.id === laterId) ?? latest
  if (a === b) return [first, latest]
  return a.dayNumber < b.dayNumber ? [a, b] : [b, a]
}

/** How long each photo stays on screen in a time-lapse of `count` photos. */
export function frameMs(count: number): number {
  return Math.min(MAX_FRAME_MS, Math.max(MIN_FRAME_MS, TIMELAPSE_MS / count))
}

/** The speed slider's slow and fast ends, in ms per photo. */
const SLOWEST_MS = 1000
const FASTEST_MS = 50

/** The time per photo at a speed slider position (0 = slow, 100 = fast), on a log scale so each step feels the same. */
export function speedToFrameMs(position: number): number {
  return Math.round(SLOWEST_MS * (FASTEST_MS / SLOWEST_MS) ** (position / 100))
}

/** The speed slider position for a time per photo: the inverse of `speedToFrameMs`. */
export function frameMsToSpeed(ms: number): number {
  return Math.round((Math.log(SLOWEST_MS / ms) / Math.log(SLOWEST_MS / FASTEST_MS)) * 100)
}

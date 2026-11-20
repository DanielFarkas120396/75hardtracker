export interface Point {
  x: number
  y: number
}

/** A stroke needs this many samples before it can be a checkmark: a tap or a flick isn't one. */
const MIN_POINTS = 8
/** Smallest checkmark accepted, in CSS pixels: a mark, not a scribble in a corner. */
const MIN_WIDTH = 40
const MIN_HEIGHT = 25

/**
 * Whether one finger stroke reads as a checkmark: a short arm down and to the
 * right, a turn at the lowest point, then a longer arm up and to the right
 * that ends higher than it started. Loose on purpose: a thumb on a phone
 * isn't a pen. Screen coordinates, so y grows downwards.
 */
export function isCheckmark(points: readonly Point[]): boolean {
  if (points.length < MIN_POINTS) return false
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const width = Math.max(...xs) - Math.min(...xs)
  const height = Math.max(...ys) - Math.min(...ys)
  if (width < MIN_WIDTH || height < MIN_HEIGHT) return false

  let low = 0
  for (let i = 1; i < points.length; i++) if (points[i].y > points[low].y) low = i
  // The turn sits in the first part of the stroke: the first arm is the short one. A fast
  // thumb leaves only a few samples on it, so there's no lower bound.
  if (low === 0 || low / (points.length - 1) > 0.6) return false

  const start = points[0]
  const turn = points[low]
  const end = points[points.length - 1]
  return (
    turn.y - start.y >= 0.15 * height && // the first arm goes down, if only a little
    turn.x >= start.x - 0.1 * width && // and not backwards
    end.x - turn.x >= 0.4 * width && // the second arm goes right
    turn.y - end.y >= 0.6 * height && // and up
    end.y < start.y // and ends higher than the start
  )
}

/** Over the pad's width and height, in fractions: the checkmark drawn for a keyboard or VoiceOver. */
export const TYPED_CHECK: readonly [number, number][] = [
  [0.32, 0.48],
  [0.45, 0.72],
  [0.7, 0.26],
]

/** A checkmark that fills the pad, sampled like a finger would draw it. */
export function typedStroke(width: number, height: number): Point[] {
  const corners = TYPED_CHECK.map(([x, y]) => ({ x: x * width, y: y * height }))
  const stroke: Point[] = []
  for (let i = 0; i < corners.length - 1; i++) {
    const a = corners[i]
    const b = corners[i + 1]
    for (let s = 0; s < 12; s++) stroke.push({ x: a.x + ((b.x - a.x) * s) / 12, y: a.y + ((b.y - a.y) * s) / 12 })
  }
  stroke.push(corners[corners.length - 1])
  return stroke
}

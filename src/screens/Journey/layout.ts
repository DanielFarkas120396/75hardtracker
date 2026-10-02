import { CHALLENGE_LENGTH } from '../../logic/constants'
import { WORLDS } from './worlds'

/**
 * Geometry of the Journey map, in SVG units. The map climbs: Day 1 sits at
 * the bottom and Day 75 at the top, under heaven's gates.
 */

export const MAP_WIDTH = 320
export const CENTER_X = MAP_WIDTH / 2
const AMPLITUDE = 78
export const DAY_SPACING = 92
/** Room above Day 75 for the gates, and below Day 1 for the road's start. */
const TOP_PADDING = 150
const BOTTOM_PADDING = 90
const WAVE_PERIOD = 4 // days per full left-right swing
/** How far above Day 75 heaven's gates stand; the road ends at their threshold. */
export const GATES_RISE = 96

export const MAP_HEIGHT = TOP_PADDING + (CHALLENGE_LENGTH - 1) * DAY_SPACING + BOTTOM_PADDING

export function xForDay(dayNumber: number): number {
  return CENTER_X + AMPLITUDE * Math.sin(((dayNumber - 1) / WAVE_PERIOD) * Math.PI * 2)
}

export function yForDay(dayNumber: number): number {
  return TOP_PADDING + (CHALLENGE_LENGTH - dayNumber) * DAY_SPACING
}

/** Which side of the road has room for scenery at this day: the side the road has swung away from. */
export function scenerySide(dayNumber: number): 'left' | 'right' {
  return xForDay(dayNumber) >= CENTER_X ? 'left' : 'right'
}

/** The vertical span of a world's band: halfway to the neighbouring days, and to the map's edges at both ends. */
export function worldBand(index: number): { top: number; bottom: number } {
  const world = WORLDS[index]
  const top = index === WORLDS.length - 1 ? 0 : yForDay(world.lastDay) - DAY_SPACING / 2
  const bottom = index === 0 ? MAP_HEIGHT : yForDay(world.firstDay) + DAY_SPACING / 2
  return { top, bottom }
}

/**
 * The road as one smooth SVG path through every day, from below Day 1 up to
 * the threshold of the gates above Day 75 (a Catmull-Rom curve turned into cubic Béziers).
 */
export function roadPath(): string {
  const points: [number, number][] = [[xForDay(0), MAP_HEIGHT + 20]]
  for (let day = 1; day <= CHALLENGE_LENGTH; day++) points.push([xForDay(day), yForDay(day)])
  points.push([CENTER_X, yForDay(CHALLENGE_LENGTH) - GATES_RISE + 26])

  let d = `M${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[Math.max(0, i - 1)]
    const [x1, y1] = points[i]
    const [x2, y2] = points[i + 1]
    const [x3, y3] = points[Math.min(points.length - 1, i + 2)]
    const c1x = x1 + (x2 - x0) / 6
    const c1y = y1 + (y2 - y0) / 6
    const c2x = x2 - (x3 - x1) / 6
    const c2y = y2 - (y3 - y1) / 6
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`
  }
  return d
}

/** A stable pseudo-random number in [0, 1) for a day, so the scenery is laid out the same way every time. */
export function seeded(dayNumber: number, salt = 0): number {
  const s = Math.sin(dayNumber * 127.1 + salt * 311.7) * 43758.5453
  return s - Math.floor(s)
}

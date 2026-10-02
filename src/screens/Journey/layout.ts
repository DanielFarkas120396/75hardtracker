import { CHALLENGE_LENGTH } from '../../logic/constants'
import { WORLDS, type WorldTile } from './worlds'

/**
 * Geometry of the Journey map, in SVG units. The map climbs: Day 1 sits at
 * the bottom and Day 75 at the top, under heaven's gates.
 */

export const MAP_WIDTH = 320
export const CENTER_X = MAP_WIDTH / 2
const AMPLITUDE = 78
export const DAY_SPACING = 92
/** Room above Day 75 for heaven's gates, and below Day 1 for the road's start. */
const TOP_PADDING = 190
const BOTTOM_PADDING = 90
const WAVE_PERIOD = 4 // days per full left-right swing
/** Where the threshold of heaven's gates (in the heaven image, at the top of the map) sits; the road ends there. */
const GATES_THRESHOLD_Y = 112

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
  points.push([CENTER_X, GATES_THRESHOLD_Y])

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

/** How far a world reaches into its neighbour, where the two cross-fade. */
export const BLEND = DAY_SPACING * 2.4
/** The share of an image's height that overlaps the copy above it, where the lower copy fades in. */
export const TILE_FADE = 0.25

export interface TilePlacement {
  tile: WorldTile
  y: number
  height: number
}

/** A world's span on the map, including where it reaches into its neighbours (not past the map's ends). */
export function worldSpan(index: number): { start: number; end: number } {
  const { top, bottom } = worldBand(index)
  return {
    start: index === WORLDS.length - 1 ? top : top - BLEND / 2,
    end: index === 0 ? bottom : bottom + BLEND / 2,
  }
}

/** The images to draw for a world, top to bottom, until they cover its span. */
export function tilePlacements(worldIndex: number): TilePlacement[] {
  const { tiles } = WORLDS[worldIndex]
  const { start, end } = worldSpan(worldIndex)

  const placements: TilePlacement[] = []
  for (let y = start, i = 0; y < end; i++) {
    // The first image is shown once; after the list runs out, the rest repeat.
    const tile = i < tiles.length ? tiles[i] : tiles.length > 1 ? tiles[1 + ((i - 1) % (tiles.length - 1))] : tiles[0]
    const height = (MAP_WIDTH * tile.height) / tile.width
    placements.push({ tile, y, height })
    y += height * (1 - TILE_FADE)
  }
  return placements
}

/**
 * Gradient stops for a smooth fade from transparent to opaque between two
 * offsets, following an eased curve (smoothstep) so the fade has no visible
 * start or end.
 */
export function easedFade(from: number, to: number, steps = 10): { offset: number; opacity: number }[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps
    return { offset: from + (to - from) * t, opacity: t * t * (3 - 2 * t) }
  })
}

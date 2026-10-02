import { CHALLENGE_LENGTH } from '../../logic/constants'

/**
 * The six worlds the Journey climbs through, from hell (Day 1, at the
 * bottom) to heaven (Day 75, at the top). Their colours are the world's own
 * and don't follow the app's light/dark theme.
 */

export type WorldId = 'hell' | 'wasteland' | 'forest' | 'meadow' | 'mountains' | 'heaven'

/** A background image (in public/journey), with its pixel size so it can be laid out before it loads. */
export interface WorldTile {
  src: string
  width: number
  height: number
}

export interface World {
  id: WorldId
  /** Shown on the roadside sign where the world begins. */
  name: string
  firstDay: number
  lastDay: number
  /** The world's backdrop colour (its images' main tone), shown where images fade and where worlds blend. */
  backdrop: string
  /** The world's stepping stones: face colour, rim colour, and the colour of the ✓ and day number on them. */
  stone: { face: string; rim: string; ink: string }
  /**
   * The world's background images, top to bottom. A world is taller than one
   * image, so after the list runs out the images after the first repeat (a
   * lone image repeats itself) — heaven's gates stay a one-off at the top.
   */
  tiles: readonly WorldTile[]
}

const tile = (name: string, height: number): WorldTile => ({ src: `/journey/${name}.webp`, width: 572, height })

export const WORLDS: readonly World[] = [
  {
    id: 'hell',
    name: 'Hell',
    firstDay: 1,
    lastDay: 10,
    backdrop: '#4e1914',
    stone: { face: '#ff7a2f', rim: '#8a1e0c', ink: '#3b0f0b' },
    tiles: [tile('hell', 766)],
  },
  {
    id: 'wasteland',
    name: 'The Wasteland',
    firstDay: 11,
    lastDay: 22,
    backdrop: '#8f857c',
    stone: { face: '#b3a598', rim: '#5e5048', ink: '#2e2520' },
    tiles: [tile('wasteland', 873)],
  },
  {
    id: 'forest',
    name: 'The Dark Forest',
    firstDay: 23,
    lastDay: 37,
    backdrop: '#4f7a63',
    stone: { face: '#b07a47', rim: '#5b3a1e', ink: '#2b1a0b' },
    tiles: [tile('forest', 870)],
  },
  {
    id: 'meadow',
    name: 'The Meadows',
    firstDay: 38,
    lastDay: 50,
    backdrop: '#cfe3bd',
    stone: { face: '#fff7fb', rim: '#e86aa0', ink: '#8c2556' },
    tiles: [tile('meadow', 864)],
  },
  {
    id: 'mountains',
    name: 'The Mountains',
    firstDay: 51,
    lastDay: 64,
    backdrop: '#cfdde9',
    stone: { face: '#e4f5ff', rim: '#6fa9cf', ink: '#1d4f73' },
    tiles: [tile('mountains', 849)],
  },
  {
    id: 'heaven',
    name: 'Heaven',
    firstDay: 65,
    lastDay: CHALLENGE_LENGTH,
    backdrop: '#f9efd8',
    stone: { face: '#ffffff', rim: '#e0b84a', ink: '#6b4e00' },
    tiles: [tile('heaven-gates', 871), tile('heaven-clouds', 629)],
  },
]

/** The world a day belongs to. Days outside 1–75 fall into the nearest end. */
export function worldForDay(dayNumber: number): World {
  return WORLDS.find((w) => dayNumber <= w.lastDay) ?? WORLDS[WORLDS.length - 1]
}

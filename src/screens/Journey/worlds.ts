import { CHALLENGE_LENGTH } from '../../logic/constants'

/**
 * The six worlds the climb goes through, from hell (Day 1) to heaven
 * (Day 75). On the Journey each one is a chapter of the logbook, under its
 * cover picture; the app's colours per world live in src/lib/worldColors.ts.
 */

export type WorldId = 'hell' | 'wasteland' | 'forest' | 'meadow' | 'mountains' | 'heaven'

export interface World {
  id: WorldId
  /** The chapter's title on the Journey, and the world's name across the app. */
  name: string
  firstDay: number
  lastDay: number
  /** The chapter's cover picture, in public/journey. */
  cover: string
  /** The world's stepping stone in the day-complete celebration: face, rim, and the ✓ and day number on it. */
  stone: { face: string; rim: string; ink: string }
}

const cover = (name: string) => `/journey/${name}.webp`

export const WORLDS: readonly World[] = [
  {
    id: 'hell',
    name: 'Hell',
    firstDay: 1,
    lastDay: 10,
    cover: cover('hell'),
    stone: { face: '#ff7a2f', rim: '#8a1e0c', ink: '#3b0f0b' },
  },
  {
    id: 'wasteland',
    name: 'The Wasteland',
    firstDay: 11,
    lastDay: 22,
    cover: cover('wasteland'),
    stone: { face: '#b3a598', rim: '#5e5048', ink: '#2e2520' },
  },
  {
    id: 'forest',
    name: 'The Dark Forest',
    firstDay: 23,
    lastDay: 37,
    cover: cover('forest'),
    stone: { face: '#b07a47', rim: '#5b3a1e', ink: '#2b1a0b' },
  },
  {
    id: 'meadow',
    name: 'The Meadows',
    firstDay: 38,
    lastDay: 50,
    cover: cover('meadow'),
    stone: { face: '#fff7fb', rim: '#e86aa0', ink: '#8c2556' },
  },
  {
    id: 'mountains',
    name: 'The Mountains',
    firstDay: 51,
    lastDay: 64,
    cover: cover('mountains'),
    stone: { face: '#e4f5ff', rim: '#6fa9cf', ink: '#1d4f73' },
  },
  {
    id: 'heaven',
    name: 'Heaven',
    firstDay: 65,
    lastDay: CHALLENGE_LENGTH,
    cover: cover('heaven-gates'),
    stone: { face: '#ffffff', rim: '#e0b84a', ink: '#6b4e00' },
  },
]

/** The world a day belongs to. Days outside 1–75 fall into the nearest end. */
export function worldForDay(dayNumber: number): World {
  return WORLDS.find((w) => dayNumber <= w.lastDay) ?? WORLDS[WORLDS.length - 1]
}

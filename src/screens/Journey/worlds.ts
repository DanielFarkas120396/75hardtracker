import { CHALLENGE_LENGTH } from '../../logic/constants'

/**
 * The six worlds the Journey climbs through, from hell (Day 1, at the
 * bottom) to heaven (Day 75, at the top). Their colours are the world's own
 * and don't follow the app's light/dark theme.
 */

export type WorldId = 'hell' | 'wasteland' | 'forest' | 'meadow' | 'mountains' | 'heaven'

export interface World {
  id: WorldId
  /** Shown on the roadside sign where the world begins. */
  name: string
  firstDay: number
  lastDay: number
  /** The world's backdrop colour; neighbouring worlds blend into each other. */
  backdrop: string
  /** The world's stepping stones: face colour, rim colour, and the colour of the ✓ and day number on them. */
  stone: { face: string; rim: string; ink: string }
}

export const WORLDS: readonly World[] = [
  {
    id: 'hell',
    name: 'Hell',
    firstDay: 1,
    lastDay: 10,
    backdrop: '#3b0f0b',
    stone: { face: '#ff7a2f', rim: '#8a1e0c', ink: '#3b0f0b' },
  },
  {
    id: 'wasteland',
    name: 'The Wasteland',
    firstDay: 11,
    lastDay: 22,
    backdrop: '#4a3c35',
    stone: { face: '#b3a598', rim: '#5e5048', ink: '#2e2520' },
  },
  {
    id: 'forest',
    name: 'The Dark Forest',
    firstDay: 23,
    lastDay: 37,
    backdrop: '#24452f',
    stone: { face: '#b07a47', rim: '#5b3a1e', ink: '#2b1a0b' },
  },
  {
    id: 'meadow',
    name: 'The Meadows',
    firstDay: 38,
    lastDay: 50,
    backdrop: '#7cc264',
    stone: { face: '#fff7fb', rim: '#e86aa0', ink: '#8c2556' },
  },
  {
    id: 'mountains',
    name: 'The Mountains',
    firstDay: 51,
    lastDay: 64,
    backdrop: '#b9cde3',
    stone: { face: '#e4f5ff', rim: '#6fa9cf', ink: '#1d4f73' },
  },
  {
    id: 'heaven',
    name: 'Heaven',
    firstDay: 65,
    lastDay: CHALLENGE_LENGTH,
    backdrop: '#fbf3da',
    stone: { face: '#ffffff', rim: '#e0b84a', ink: '#6b4e00' },
  },
]

/** The world a day belongs to. Days outside 1–75 fall into the nearest end. */
export function worldForDay(dayNumber: number): World {
  return WORLDS.find((w) => dayNumber <= w.lastDay) ?? WORLDS[WORLDS.length - 1]
}

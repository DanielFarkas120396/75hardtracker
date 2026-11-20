import { CHALLENGE_LENGTH } from './constants'

/**
 * The six worlds the climb goes through, from hell (Day 1) to heaven
 * (Day 75): the part the rules and both apps share. The web Journey adds each
 * world's cover picture in src/screens/Journey/worlds.ts; the app's colours
 * per world live in ./worldColors.
 */

export type WorldId = 'hell' | 'wasteland' | 'forest' | 'meadow' | 'mountains' | 'heaven'

export interface WorldSpan {
  id: WorldId
  /** The chapter's title on the Journey, and the world's name across the app. */
  name: string
  firstDay: number
  lastDay: number
  /** The world's stepping stone in the day-complete celebration: face, rim, and the ✓ and day number on it. */
  stone: { face: string; rim: string; ink: string }
}

export const WORLD_SPANS: readonly WorldSpan[] = [
  {
    id: 'hell',
    name: 'Hell',
    firstDay: 1,
    lastDay: 10,
    stone: { face: '#ff7a2f', rim: '#8a1e0c', ink: '#3b0f0b' },
  },
  {
    id: 'wasteland',
    name: 'The Wasteland',
    firstDay: 11,
    lastDay: 22,
    stone: { face: '#b3a598', rim: '#5e5048', ink: '#2e2520' },
  },
  {
    id: 'forest',
    name: 'The Dark Forest',
    firstDay: 23,
    lastDay: 37,
    stone: { face: '#b07a47', rim: '#5b3a1e', ink: '#2b1a0b' },
  },
  {
    id: 'meadow',
    name: 'The Meadows',
    firstDay: 38,
    lastDay: 50,
    stone: { face: '#fff7fb', rim: '#e86aa0', ink: '#8c2556' },
  },
  {
    id: 'mountains',
    name: 'The Mountains',
    firstDay: 51,
    lastDay: 64,
    stone: { face: '#e4f5ff', rim: '#6fa9cf', ink: '#1d4f73' },
  },
  {
    id: 'heaven',
    name: 'Heaven',
    firstDay: 65,
    lastDay: CHALLENGE_LENGTH,
    stone: { face: '#ffffff', rim: '#e0b84a', ink: '#6b4e00' },
  },
]

/** The world a day belongs to. Days outside 1–75 fall into the nearest end. */
export function worldSpanForDay(dayNumber: number): WorldSpan {
  return WORLD_SPANS.find((w) => dayNumber <= w.lastDay) ?? WORLD_SPANS[WORLD_SPANS.length - 1]
}

/**
 * The world whose colours the app wears: the one the current attempt's day is
 * in. Before the start, with no attempt or with a broken start date, that's
 * hell (the bottom of the climb); after victory, heaven.
 */
export function worldForProgress(todayDayNumber: number | null, completed: boolean): WorldId {
  if (completed) return 'heaven'
  if (todayDayNumber === null || !Number.isFinite(todayDayNumber) || todayDayNumber < 1) return 'hell'
  return worldSpanForDay(todayDayNumber).id
}

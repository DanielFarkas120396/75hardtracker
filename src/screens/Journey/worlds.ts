import { WORLD_SPANS, type WorldId, type WorldSpan } from '../../logic/worlds'

/**
 * The six worlds as the Journey shows them: each one is a chapter of the
 * logbook, under its cover picture. Their days, names and stones are shared
 * with the rules (src/logic/worlds.ts).
 */

export type { WorldId }

export interface World extends WorldSpan {
  /** The chapter's cover picture, in public/journey. */
  cover: string
}

const COVER_FILES: Record<WorldId, string> = {
  hell: 'hell',
  wasteland: 'wasteland',
  forest: 'forest',
  meadow: 'meadow',
  mountains: 'mountains',
  heaven: 'heaven-gates',
}

export const WORLDS: readonly World[] = WORLD_SPANS.map((span) => ({
  ...span,
  cover: `/journey/${COVER_FILES[span.id]}.webp`,
}))

/** The world a day belongs to. Days outside 1–75 fall into the nearest end. */
export function worldForDay(dayNumber: number): World {
  return WORLDS.find((w) => dayNumber <= w.lastDay) ?? WORLDS[WORLDS.length - 1]
}

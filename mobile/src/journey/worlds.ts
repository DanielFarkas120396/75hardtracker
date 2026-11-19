import { WORLD_SPANS, type WorldId, type WorldSpan } from '@logic/worlds'

/** A world as the Journey shows it: its span (days, name) and its cover picture, the web's six (public/journey). */
export interface World extends WorldSpan {
  /** The picture, bundled with the app (a `require`d asset). */
  cover: number
}

const COVERS: Record<WorldId, number> = {
  hell: require('../../assets/images/journey/hell.webp'),
  wasteland: require('../../assets/images/journey/wasteland.webp'),
  forest: require('../../assets/images/journey/forest.webp'),
  meadow: require('../../assets/images/journey/meadow.webp'),
  mountains: require('../../assets/images/journey/mountains.webp'),
  heaven: require('../../assets/images/journey/heaven-gates.webp'),
}

export const WORLDS: readonly World[] = WORLD_SPANS.map((span) => ({ ...span, cover: COVERS[span.id] }))

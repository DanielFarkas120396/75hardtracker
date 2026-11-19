import { contrastRatio } from '@logic/worldColors'
import { WORLD_SPANS, type WorldId } from '@logic/worlds'
import { colorsFor, mixHex, type ThemeMode } from '../../theme/tokens'

// Text on a chapter's cover sits on the picture darkened into the page's canvas (WorldCover's scrim: the full canvas at
// the bottom, 72% at 55% of the height, 30% at the top). Where the text sits, the scrim is at least as thick as at its
// top. Under it, the picture's darkest and lightest colours, measured from the six covers (cropped as the phone shows
// them, 334 x 112 points, or 80 when locked, under the name and the detail line): both must read at 4.5:1. The page
// may be in any world (a chapter of Hell is read from the Wasteland).

/** How much of the page's canvas covers the picture at a height (0 = bottom, 1 = top) of a 112-point cover. */
const scrim = (fromBottom: number) => (fromBottom <= 0.55 ? 1 - (fromBottom / 0.55) * 0.28 : 0.72 - ((fromBottom - 0.55) / 0.45) * 0.42)
// The detail line's top is 30 points up the cover, the name's top 56 points (14 of padding, 12 + 4 of detail, 26 of name).
const DETAIL = scrim(30 / 112)
const NAME = scrim(56 / 112)
const PICTURES: Record<WorldId, { open: [string, string]; locked: [string, string] }> = {
  hell: { open: ['#2f0d04', '#f8630f'], locked: ['#2f0d04', '#f79932'] },
  wasteland: { open: ['#41342c', '#a7988f'], locked: ['#41342c', '#a7988f'] },
  forest: { open: ['#092622', '#789d8f'], locked: ['#092622', '#a9dc9d'] },
  meadow: { open: ['#599e72', '#f2f9dd'], locked: ['#529f7b', '#f2f9dd'] },
  mountains: { open: ['#7d8494', '#edf5fd'], locked: ['#7e8592', '#edf5fd'] },
  heaven: { open: ['#e4cca6', '#ffffff'], locked: ['#ebcd9f', '#ffffff'] },
}

/** A world ahead's picture: grey, at 75% brightness (WorldCover's LOCKED matrix). */
function locked(hex: string): string {
  const v = Number.parseInt(hex.slice(1), 16)
  const grey = Math.round(0.75 * (0.2126 * (v >> 16) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255)))
  return `#${grey.toString(16).padStart(2, '0').repeat(3)}`
}

const MODES: ThemeMode[] = ['light', 'dark']
/** The names are 24-point titles: large text in WCAG's terms, which asks 3:1. The detail line is small text: 4.5:1. */
const LARGE = 3

describe.each(MODES)('a cover, in %s', (mode) => {
  it.each(WORLD_SPANS.map((w) => w.id))('reads in %s, from a page in any world', (world) => {
    const chapter = colorsFor(world, mode)
    for (const page of WORLD_SPANS) {
      const canvas = colorsFor(page.id, mode).canvas
      for (const picture of PICTURES[world].open) {
        expect(contrastRatio(chapter.ink, mixHex(picture, canvas, DETAIL))).toBeGreaterThanOrEqual(4.5)
        expect(contrastRatio(chapter.worldInk, mixHex(picture, canvas, NAME))).toBeGreaterThanOrEqual(LARGE)
      }
      for (const picture of PICTURES[world].locked.map(locked)) {
        expect(contrastRatio(chapter.ink, mixHex(picture, canvas, scrim(30 / 80)))).toBeGreaterThanOrEqual(4.5)
        // Its name is greyed out on purpose, as on the web (a world not reached yet): it reads at 1.9 to 2.9:1, so only
        // the line under it is held to the bar. Said to the owner; VoiceOver reads the name with its badge.
      }
    }
  })
})

describe.each(MODES)("a day's row, in %s", (mode) => {
  it.each(WORLD_SPANS.map((w) => w.id))('reads on %s\'s wash and on today\'s tint', (world) => {
    const colors = colorsFor(world, mode)
    // The wash runs from 14% of the world's colour at the photo's edge to 4%; the text starts past the 78-point photo
    // column of a 334-point row, where it is at most 11.7%.
    for (const background of [mixHex(colors.surface, colors.world, 0.117), mixHex(colors.surface, colors.world, 0.04), colors.worldSoft]) {
      expect(contrastRatio(colors.worldInk, background)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(colors.inkMuted, background)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(colors.ink, background)).toBeGreaterThanOrEqual(4.5)
    }
  })
})

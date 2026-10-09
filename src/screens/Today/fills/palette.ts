import { contrastRatio, SURFACE, type WorldPalette } from '../../../lib/worldColors'
import type { PainterKind } from './painter'

export type RGB = readonly [number, number, number]
export type Mode = 'light' | 'dark'

/** The tiles' text colour in each theme (--color-ink). Over a fill the status line uses it too. */
export const TILE_INK: Record<Mode, string> = { light: '#2a211b', dark: '#f6ecdc' }

const WHITE: RGB = [1, 1, 1]
const BLACK: RGB = [0, 0, 0]

export function rgb(hex: string): RGB {
  const n = Number.parseInt(hex.slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

export function toHex(c: RGB): string {
  return `#${c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('')}`
}

export function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

/** A fill's colours, all from the world's palette. Kept in sRGB: the fill shaders write them as they are. */
export interface FillPalette {
  mode: Mode
  /** Thin bright lines: streaks, the water's surface line, bubbles. */
  light: RGB
  /** The lightest body tone: the top of the water, the ink's pale parts. */
  top: RGB
  /** The world's colour. */
  mid: RGB
  /** The darkest body tone: deep water, the ink's veins. */
  deep: RGB
  /** The world's edge colour: the back of a turning page. */
  edge: RGB
  /** The world's ink: an iris blade's lit edge. */
  ink: RGB
}

/** How far each tone is pushed from the world's colour (to white; to black for deep), per theme. Fitted to the prototypes' forest greens. */
const TONES: Record<Mode, { light: number; top: number; deep: number }> = {
  dark: { light: 0.72, top: 0.15, deep: 0.55 },
  light: { light: 0.8, top: 0.35, deep: 0.25 },
}

export function fillPalette(world: WorldPalette, mode: Mode): FillPalette {
  const base = rgb(world.world)
  const tones = TONES[mode]
  return {
    mode,
    light: mix(base, WHITE, tones.light),
    top: mix(base, WHITE, tones.top),
    mid: base,
    deep: mix(base, BLACK, tones.deep),
    edge: rgb(world.edge),
    ink: rgb(world.ink),
  }
}

/** Each fill as chosen in the prototypes: its opacity, and how opaque its body is under the tile's text. */
export const FILL_LOOK: Record<PainterKind, { opacity: number; body: number }> = {
  wave: { opacity: 0.78, body: 0.78 },
  ink: { opacity: 0.67, body: 1 },
  sprint: { opacity: 0.85, body: 0.62 },
  iris: { opacity: 0.85, body: 1 },
  book: { opacity: 1, body: 0.3 },
}

/** The worst contrast the tile's text gets over a fill whose body covers the tile at `alpha` (the thin bright lines don't count). */
export function textContrastOver(palette: FillPalette, alpha: number): number {
  const surface = rgb(SURFACE[palette.mode])
  return Math.min(
    ...[palette.top, palette.mid, palette.deep].map((tone) => contrastRatio(TILE_INK[palette.mode], toHex(mix(surface, tone, alpha)))),
  )
}

/** A fill's opacity: as chosen, lowered only as far as the tile's text needs to keep 4.5:1. */
export function fillOpacity(kind: PainterKind, palette: FillPalette): number {
  const look = FILL_LOOK[kind]
  let percent = Math.round(look.opacity * 100)
  while (percent > 5 && textContrastOver(palette, (percent / 100) * look.body) < 4.5) percent -= 1
  return percent / 100
}

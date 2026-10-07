import type { WorldId } from '../screens/Journey/worlds'

/**
 * One world's colours in one theme, as worn by the whole app (not the
 * Journey map, which has its own images). Mirrored as CSS tokens in
 * src/styles/index.css and, for the canvas, in index.html's no-flash script;
 * tests keep all three in sync and check the contrast.
 */
export interface WorldPalette {
  /** Accent fill: rings, the active nav pill, primary buttons, done ticks. */
  world: string
  /** The darker "pressed" edge under world-coloured buttons. */
  edge: string
  /** Text and icons in the world colour (>= 4.5:1 on surface, canvas and soft). */
  ink: string
  /** Tint: hero background, active and done states, chips. */
  soft: string
  /** The page background, a faint tint of the world. */
  canvas: string
  /** Text on a `world` fill (>= 4.5:1). */
  onWorld: string
}

/** The card surface of each theme (--color-surface). */
export const SURFACE = { light: '#ffffff', dark: '#221a15' } as const

const palette = (world: string, edge: string, ink: string, soft: string, canvas: string, onWorld: string) => ({
  world,
  edge,
  ink,
  soft,
  canvas,
  onWorld,
})

export const WORLD_COLORS: Record<WorldId, { light: WorldPalette; dark: WorldPalette }> = {
  hell: {
    light: palette('#c98a3a', '#a06c2a', '#8a5612', '#f6e6cf', '#f9f3ea', '#1f1813'),
    dark: palette('#e2a45a', '#b07c3c', '#e8b573', '#30241a', '#16110e', '#1f1813'),
  },
  wasteland: {
    light: palette('#9c8f7f', '#7b7062', '#6a5e51', '#ece5dc', '#f7f4f0', '#1f1813'),
    dark: palette('#b8a995', '#8c8070', '#c9bba8', '#2a2520', '#15120f', '#1f1813'),
  },
  forest: {
    light: palette('#5f9a6e', '#4a7a56', '#2f6a40', '#dcebe0', '#f1f6f2', '#1f1813'),
    dark: palette('#7fb08a', '#5f8a69', '#93c29e', '#1c2a20', '#10140f', '#1f1813'),
  },
  meadow: {
    light: palette('#7fa85e', '#64874a', '#466b2c', '#e3edd6', '#f4f7ee', '#1f1813'),
    dark: palette('#9bc27a', '#789a5c', '#abd08c', '#22291b', '#121410', '#1f1813'),
  },
  mountains: {
    light: palette('#6f9bc0', '#557c9c', '#2f6690', '#dde9f2', '#f1f5f9', '#1f1813'),
    dark: palette('#8fb6d6', '#6b8fad', '#a3c6e2', '#1e252c', '#10141a', '#1f1813'),
  },
  heaven: {
    light: palette('#d4b25a', '#a88c42', '#7d6212', '#f5ebcd', '#faf6ea', '#1f1813'),
    dark: palette('#e8c76a', '#bc9f4a', '#edd07e', '#2f2918', '#171409', '#1f1813'),
  },
}

export function isWorldId(value: unknown): value is WorldId {
  return typeof value === 'string' && Object.hasOwn(WORLD_COLORS, value)
}

/** Relative luminance of a #rrggbb colour (WCAG 2). */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio between two #rrggbb colours, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (high + 0.05) / (low + 0.05)
}

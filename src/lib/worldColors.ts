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
export const SURFACE = { light: '#ffffff', dark: '#1f2426' } as const

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
    light: palette('#cb4a1b', '#9e3915', '#b33a12', '#fde6dc', '#fdf6f3', '#ffffff'),
    dark: palette('#ff6a2a', '#c65220', '#ff8a5a', '#3a1812', '#1a1211', '#1f2426'),
  },
  wasteland: {
    light: palette('#807266', '#63584f', '#6b5d52', '#efe9e3', '#f8f6f3', '#ffffff'),
    dark: palette('#b3a598', '#8b8076', '#cbbfb3', '#2e2824', '#171513', '#1f2426'),
  },
  forest: {
    light: palette('#2f7d4f', '#24613d', '#22643c', '#dcefe2', '#f4f9f5', '#ffffff'),
    dark: palette('#4fae74', '#3d875a', '#6fd093', '#16301f', '#111815', '#1f2426'),
  },
  meadow: {
    light: palette('#368532', '#2a6727', '#2f7a2b', '#e1f2d6', '#f6fbf1', '#ffffff'),
    dark: palette('#6cc35e', '#549849', '#8fdc80', '#1e3418', '#121811', '#1f2426'),
  },
  mountains: {
    light: palette('#3279ae', '#275e87', '#1f6aa3', '#dfeefa', '#f4f8fc', '#ffffff'),
    dark: palette('#7cc0f0', '#6095bb', '#9fd2f7', '#1c2a38', '#10161c', '#1f2426'),
  },
  heaven: {
    light: palette('#d9a521', '#a98019', '#8a6100', '#fbf0cf', '#fdfaf0', '#1f2426'),
    dark: palette('#f3c23a', '#bd972d', '#ffd76a', '#3a3017', '#17150e', '#1f2426'),
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

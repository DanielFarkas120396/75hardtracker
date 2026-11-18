import { WORLD_COLORS } from '@logic/worldColors'
import type { WorldId } from '@logic/worlds'

/**
 * The Ember look's colours that don't depend on the world: the same values as
 * the `--color-*` tokens in the web app's src/styles/index.css (`@theme` for
 * light, `.dark` over it for dark). A test compares the two, so change them
 * there and here together.
 */
export const BASE_COLORS = {
  light: {
    green: '#6fb584',
    greenDark: '#4f9465',
    greenLight: '#e4f1e7',
    orange: '#e08a4a',
    orangeDark: '#bf6f30',
    orangeLight: '#f9e8d9',
    blue: '#7fb3d6',
    blueDark: '#5a92b8',
    blueLight: '#e2eef6',
    yellow: '#e6c15c',
    yellowDark: '#c3a03c',
    yellowLight: '#f8f0d4',
    purple: '#b39ddb',
    purpleDark: '#9279c4',
    purpleLight: '#ece6f6',
    danger: '#e5655f',
    dangerDark: '#c4443f',
    greenDeep: '#136536',
    greenInk: '#177640',
    orangeInk: '#b4480f',
    blueInk: '#0b6aa6',
    yellowInk: '#8a6100',
    purpleInk: '#6b3fd4',
    dangerInk: '#c0282e',
    surface: '#ffffff',
    ink: '#2a211b',
    inkMuted: '#6f655b',
    onAccent: '#1f1813',
    chartGrid: '#e7eae7',
    stackFrom: '#e08a4a',
    stackTo: '#f3d9c0',
    onStack: '#3d1a05',
    stackGlow: '#f3a865',
    dust: '#c08a48',
  },
  dark: {
    green: '#6fb584',
    greenDark: '#4f9465',
    greenLight: '#1d2a20',
    orange: '#e08a4a',
    orangeDark: '#bf6f30',
    orangeLight: '#33231a',
    blue: '#7fb3d6',
    blueDark: '#5a92b8',
    blueLight: '#1c252c',
    yellow: '#e6c15c',
    yellowDark: '#c3a03c',
    yellowLight: '#302918',
    purple: '#b39ddb',
    purpleDark: '#9279c4',
    purpleLight: '#272232',
    danger: '#e5655f',
    dangerDark: '#c4443f',
    greenDeep: '#136536',
    greenInk: '#93c29e',
    orangeInk: '#e8a06a',
    blueInk: '#a3c6e2',
    yellowInk: '#edd07e',
    purpleInk: '#c9b8e8',
    dangerInk: '#ff6b70',
    surface: '#221a15',
    ink: '#f6ecdc',
    inkMuted: '#a1998d',
    onAccent: '#1f1813',
    chartGrid: '#342a23',
    stackFrom: '#8a5a2a',
    stackTo: '#3a2a1e',
    onStack: '#fff1e6',
    stackGlow: '#b8733a',
    dust: '#f6e3c0',
  },
} as const

export type ThemeMode = keyof typeof BASE_COLORS

/** Every colour of one world in one theme: the base colours plus the world's own (WORLD_COLORS). */
export function colorsFor(world: WorldId, mode: ThemeMode) {
  const palette = WORLD_COLORS[world][mode]
  return {
    ...BASE_COLORS[mode],
    canvas: palette.canvas,
    world: palette.world,
    worldEdge: palette.edge,
    worldInk: palette.ink,
    worldSoft: palette.soft,
    onWorld: palette.onWorld,
  }
}

export type ThemeColors = ReturnType<typeof colorsFor>

/** A hex colour at an opacity, as rgba: the web's `bg-ink/8`. */
export function withAlpha(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16)
  return `rgba(${value >> 16}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`
}

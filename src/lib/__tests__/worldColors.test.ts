/// <reference types="node" />
// Reads a source file from disk (vitest empties CSS, even ?raw imports).
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { WORLDS } from '../../screens/Journey/worlds'
import { TILE_INK } from '../../screens/Today/fills/palette'
import { contrastRatio, isWorldId, SURFACE, WORLD_COLORS } from '../worldColors'

describe('contrastRatio', () => {
  it('matches the WCAG formula at its ends', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21)
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1)
  })
})

describe('WORLD_COLORS', () => {
  it('has a palette for every Journey world', () => {
    expect(Object.keys(WORLD_COLORS).sort()).toEqual(WORLDS.map((w) => w.id).sort())
    expect(isWorldId('heaven')).toBe(true)
    expect(isWorldId('mars')).toBe(false)
  })

  for (const mode of ['light', 'dark'] as const) {
    it.each(WORLDS.map((w) => w.id))(`keeps text readable in %s (${mode})`, (id) => {
      const p = WORLD_COLORS[id][mode]
      for (const bg of [SURFACE[mode], p.canvas, p.soft]) expect(contrastRatio(p.ink, bg)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(p.onWorld, p.world)).toBeGreaterThanOrEqual(4.5)
    })

    // The onboarding's evening warning: danger text in a world-soft box on the canvas.
    it.each(WORLDS.map((w) => w.id))(`keeps warnings readable in %s (${mode})`, (id) => {
      const p = WORLD_COLORS[id][mode]
      for (const bg of [p.canvas, p.soft]) expect(contrastRatio(DANGER_INK[mode], bg)).toBeGreaterThanOrEqual(4.5)
    })
  }
})

/** --color-danger-ink, in index.css (checked below). */
const DANGER_INK = { light: '#c0282e', dark: '#ff6b70' } as const

const TOKENS = {
  world: 'world',
  edge: 'world-edge',
  ink: 'world-ink',
  soft: 'world-soft',
  onWorld: 'on-world',
  canvas: 'canvas',
} as const

describe('index.css', () => {
  // Git may check the file out with Windows line endings.
  const css = readFileSync(resolve(process.cwd(), 'src/styles/index.css'), 'utf8').replace(/\r\n/g, '\n')
  const block = (selector: string) => {
    const start = css.indexOf(`${selector} {`)
    expect(start, selector).toBeGreaterThanOrEqual(0)
    return css.slice(start, css.indexOf('}', start))
  }

  it.each(WORLDS.map((w) => w.id))('defines the %s tokens in both themes, matching WORLD_COLORS', (id) => {
    for (const mode of ['light', 'dark'] as const) {
      const body = block(mode === 'dark' ? `.dark[data-world='${id}'],\n.dark [data-world='${id}']` : `[data-world='${id}']`)
      for (const [key, token] of Object.entries(TOKENS)) {
        expect(body).toContain(`--color-${token}: ${WORLD_COLORS[id][mode][key as keyof typeof TOKENS]};`)
      }
    }
  })

  it('defines the danger ink checked above, in both themes', () => {
    expect(block('@theme')).toContain(`--color-danger-ink: ${DANGER_INK.light};`)
    expect(block('.dark')).toContain(`--color-danger-ink: ${DANGER_INK.dark};`)
  })

  // The fills' opacities are computed for this ink over this surface (palette.ts).
  it('defines the tile surface and ink the fills are checked against, in both themes', () => {
    for (const [selector, mode] of [['@theme', 'light'], ['.dark', 'dark']] as const) {
      expect(block(selector)).toContain(`--color-surface: ${SURFACE[mode]};`)
      expect(block(selector)).toContain(`--color-ink: ${TILE_INK[mode]};`)
    }
  })
})

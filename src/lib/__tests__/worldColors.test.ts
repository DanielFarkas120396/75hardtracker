import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { WORLDS } from '../../screens/Journey/worlds'
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
  }
})

const TOKENS = {
  world: 'world',
  edge: 'world-edge',
  ink: 'world-ink',
  soft: 'world-soft',
  onWorld: 'on-world',
  canvas: 'canvas',
} as const

describe('index.css', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/styles/index.css'), 'utf8')
  const block = (selector: string) => {
    const start = css.indexOf(`${selector} {`)
    expect(start, selector).toBeGreaterThanOrEqual(0)
    return css.slice(start, css.indexOf('}', start))
  }

  it.each(WORLDS.map((w) => w.id))('defines the %s tokens in both themes, matching WORLD_COLORS', (id) => {
    for (const mode of ['light', 'dark'] as const) {
      const body = block(`${mode === 'dark' ? '.dark' : ''}[data-world='${id}']`)
      for (const [key, token] of Object.entries(TOKENS)) {
        expect(body).toContain(`--color-${token}: ${WORLD_COLORS[id][mode][key as keyof typeof TOKENS]};`)
      }
    }
  })
})

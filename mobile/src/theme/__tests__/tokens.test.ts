/** @jest-environment node */
// Reads the web app's stylesheet from disk, as its own colour tests do
// (src/lib/__tests__/brandColors.test.ts): both apps must wear the same colours.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { contrastRatio } from '@logic/worldColors'
import { WORLD_SPANS } from '@logic/worlds'
import { BASE_COLORS, colorsFor } from '../tokens'

const css = readFileSync(resolve(__dirname, '../../../../src/styles/index.css'), 'utf8').replace(/\r\n/g, '\n')

/** The `--color-*: #rrggbb;` tokens of one block, by camelCase name. World colours come from WORLD_COLORS instead. */
function hexTokens(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`)
  expect(start).toBeGreaterThanOrEqual(0)
  const body = css.slice(start, css.indexOf('\n}', start))
  const tokens: Record<string, string> = {}
  for (const [, name, hex] of body.matchAll(/^\s*--color-([a-z-]+): (#[0-9a-f]{6});/gm)) {
    if (name === 'canvas' || name.includes('world')) continue
    tokens[name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())] = hex
  }
  return tokens
}

const light = hexTokens('@theme')
const dark = { ...light, ...hexTokens('.dark') }

it('the stylesheet still has the tokens this test reads', () => {
  expect(Object.keys(light).length).toBeGreaterThanOrEqual(25)
  const changedInDark = Object.keys(dark).filter((name) => dark[name] !== light[name])
  expect(changedInDark.length).toBeGreaterThanOrEqual(15)
})

it('light base colours equal the web tokens', () => {
  expect(BASE_COLORS.light).toEqual(light)
})

it('dark base colours equal the web tokens', () => {
  expect(BASE_COLORS.dark).toEqual(dark)
})

it.each(WORLD_SPANS.flatMap((span) => [[span.id, 'light'] as const, [span.id, 'dark'] as const]))(
  '%s %s text meets 4.5:1',
  (world, mode) => {
    const colors = colorsFor(world, mode)
    for (const background of [colors.surface, colors.canvas, colors.worldSoft]) {
      expect(contrastRatio(colors.worldInk, background)).toBeGreaterThanOrEqual(4.5)
    }
    expect(contrastRatio(colors.onWorld, colors.world)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(colors.ink, colors.canvas)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(colors.ink, colors.surface)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(colors.inkMuted, colors.canvas)).toBeGreaterThanOrEqual(4.5)
  },
)

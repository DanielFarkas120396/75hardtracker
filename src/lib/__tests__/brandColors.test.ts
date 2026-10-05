/// <reference types="node" />
// Reads a source file from disk (vitest empties CSS, even ?raw imports).
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contrastRatio, SURFACE } from '../worldColors'

const BRAND = ['green', 'orange', 'blue', 'yellow', 'purple'] as const

describe('brand ink colours', () => {
  // Git may check the file out with Windows line endings.
  const css = readFileSync(resolve(process.cwd(), 'src/styles/index.css'), 'utf8').replace(/\r\n/g, '\n')
  const block = (selector: string) => {
    const start = css.indexOf(`${selector} {`)
    expect(start, selector).toBeGreaterThanOrEqual(0)
    return css.slice(start, css.indexOf('\n}', start))
  }
  const token = (body: string, name: string) => {
    const match = body.match(new RegExp(`--color-${name}: (#[0-9a-f]{6});`))
    expect(match, name).not.toBeNull()
    return match![1]
  }

  for (const mode of ['light', 'dark'] as const) {
    const body = block(mode === 'dark' ? '.dark' : '@theme')
    it.each(BRAND)(`keeps %s-ink readable on surface, canvas and its tint (${mode})`, (name) => {
      const ink = token(body, `${name}-ink`)
      for (const bg of [SURFACE[mode], token(body, 'canvas'), token(body, `${name}-light`)]) {
        expect(contrastRatio(ink, bg), `${name}-ink on ${bg}`).toBeGreaterThanOrEqual(4.5)
      }
    })
  }
})

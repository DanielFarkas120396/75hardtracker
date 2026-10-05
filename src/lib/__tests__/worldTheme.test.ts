/// <reference types="node" />
// Reads a source file from disk (vitest empties CSS, even ?raw imports).
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useWorldTheme } from '../../hooks/useWorldTheme'
import type { WorldId } from '../../screens/Journey/worlds'
import { applyTheme } from '../theme'
import { WORLD_COLORS } from '../worldColors'
import { applyWorld, WORLD_STORAGE_KEY, worldForProgress } from '../worldTheme'

beforeEach(() => {
  // jsdom has no matchMedia; the system theme is light.
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: !query.includes('dark'), media: query }))
  document.head.innerHTML = `
    <meta name="theme-color" content="" media="(prefers-color-scheme: light)">
    <meta name="theme-color" content="" media="(prefers-color-scheme: dark)">`
  document.documentElement.removeAttribute('data-world')
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const metaColors = () => [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => m.getAttribute('content'))

describe('worldForProgress', () => {
  it('follows the Journey worlds day by day', () => {
    expect(worldForProgress(1, false)).toBe('hell')
    expect(worldForProgress(11, false)).toBe('wasteland')
    expect(worldForProgress(23, false)).toBe('forest')
    expect(worldForProgress(65, false)).toBe('heaven')
  })

  it('stays in hell before the start, with no attempt or a broken date; victory is heaven', () => {
    expect(worldForProgress(-3, false)).toBe('hell')
    expect(worldForProgress(null, false)).toBe('hell')
    expect(worldForProgress(Number.NaN, false)).toBe('hell')
    expect(worldForProgress(75, true)).toBe('heaven')
  })
})

describe('applyWorld', () => {
  it('sets data-world, remembers it, and paints the browser chrome with the world canvas', () => {
    applyTheme('light')
    applyWorld('forest')
    expect(document.documentElement.dataset.world).toBe('forest')
    expect(localStorage.getItem(WORLD_STORAGE_KEY)).toBe('forest')
    expect(metaColors()).toEqual([WORLD_COLORS.forest.light.canvas, WORLD_COLORS.forest.light.canvas])
  })
})

describe('useWorldTheme', () => {
  it('updates when the day moves into a new world, and waits while the world is unknown', () => {
    const { rerender } = renderHook(({ world }) => useWorldTheme(world), {
      initialProps: { world: undefined as WorldId | undefined },
    })
    expect(document.documentElement.dataset.world).toBeUndefined()
    rerender({ world: 'hell' })
    expect(document.documentElement.dataset.world).toBe('hell')
    rerender({ world: 'wasteland' })
    expect(document.documentElement.dataset.world).toBe('wasteland')
  })
})

describe('index.html no-flash script', () => {
  it('knows every world canvas, in light and dark', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
    for (const [id, { light, dark }] of Object.entries(WORLD_COLORS)) {
      expect(html).toContain(`${id}: ['${light.canvas}', '${dark.canvas}']`)
    }
    expect(html).toContain(`'${WORLD_STORAGE_KEY}'`)
  })
})

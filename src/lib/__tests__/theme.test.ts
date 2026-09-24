import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../db/db'
import { SETTING_KEYS } from '../../db/repositories/settingsRepo'
import { useApplyTheme } from '../../hooks/useThemePreference'
import { applyTheme, resolveTheme, THEME_STORAGE_KEY } from '../theme'

/** A controllable prefers-color-scheme media query. */
function mockSystemTheme(initiallyDark: boolean) {
  let dark = initiallyDark
  const listeners = new Set<() => void>()
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return query.includes('dark') ? dark : !dark
    },
    media: query,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  }))
  return {
    setDark(value: boolean) {
      dark = value
      listeners.forEach((listener) => listener())
    },
  }
}

beforeEach(() => {
  document.head.innerHTML = `
    <meta name="theme-color" content="#fbfbf8" media="(prefers-color-scheme: light)">
    <meta name="theme-color" content="#14181a" media="(prefers-color-scheme: dark)">`
  document.documentElement.className = ''
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const metaColors = () => [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => m.getAttribute('content'))

describe('resolveTheme', () => {
  it('follows the system only when set to system', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })
})

describe('applyTheme', () => {
  it('forces dark: class, color-scheme and both theme-color metas', () => {
    mockSystemTheme(false)
    applyTheme('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(metaColors()).toEqual(['#14181a', '#14181a'])
  })

  it('restores each meta to its own media query when back on system', () => {
    mockSystemTheme(false)
    applyTheme('dark')
    applyTheme('system')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(metaColors()).toEqual(['#fbfbf8', '#14181a'])
  })
})

describe('useApplyTheme', () => {
  beforeEach(async () => {
    await db.settings.clear()
  })

  it('follows OS changes live while the preference is "system", and mirrors it to localStorage', async () => {
    const system = mockSystemTheme(false)
    renderHook(() => useApplyTheme())

    await waitFor(() => expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('system'))
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    system.setDark(true)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('applies a saved preference and ignores the OS while it is forced', async () => {
    await db.settings.put({ key: SETTING_KEYS.theme, value: 'dark' })
    const system = mockSystemTheme(false)
    renderHook(() => useApplyTheme())

    await waitFor(() => expect(document.documentElement.classList.contains('dark')).toBe(true))
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')

    system.setDark(false)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})

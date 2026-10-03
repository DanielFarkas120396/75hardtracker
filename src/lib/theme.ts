import { isWorldId, WORLD_COLORS } from './worldColors'

export type ThemePreference = 'system' | 'light' | 'dark'

export const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark']

/**
 * localStorage mirror of the Dexie `theme` setting. Dexie stays the source
 * of truth; the mirror exists so the inline script in index.html can apply
 * the theme before the first paint (IndexedDB is async). Keep the key in sync
 * with that script (and the world canvases, from worldColors.ts).
 */
export const THEME_STORAGE_KEY = '75hard-theme'

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark'
}

export function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function resolveTheme(preference: ThemePreference, prefersDark: boolean): 'light' | 'dark' {
  return preference === 'system' ? (prefersDark ? 'dark' : 'light') : preference
}

/** Applies a theme to <html> (`.dark` class and color-scheme, the preference for syncThemeColor) and to the theme-color meta tags. */
export function applyTheme(preference: ThemePreference): void {
  const theme = resolveTheme(preference, systemPrefersDark())
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
  root.dataset.themePreference = preference
  syncThemeColor()
}

/**
 * Paints the theme-color metas (the browser chrome, the iPhone status bar)
 * with the current world's canvas: each meta's own scheme under "system",
 * else the forced theme.
 */
export function syncThemeColor(): void {
  const root = document.documentElement
  const preference = isThemePreference(root.dataset.themePreference) ? root.dataset.themePreference : 'system'
  const colors = WORLD_COLORS[isWorldId(root.dataset.world) ? root.dataset.world : 'hell']
  const theme = resolveTheme(preference, systemPrefersDark())
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const ownScheme = (meta.getAttribute('media') ?? '').includes('dark') ? 'dark' : 'light'
    meta.content = colors[preference === 'system' ? ownScheme : theme].canvas
  }
}

export function mirrorThemePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // Storage can be unavailable (private mode, blocked site data); the theme still applies this session.
  }
}

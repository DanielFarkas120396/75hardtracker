export type ThemePreference = 'system' | 'light' | 'dark'

export const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark']

/**
 * localStorage mirror of the Dexie `theme` setting. Dexie stays the source
 * of truth; the mirror exists so the inline script in index.html can apply
 * the theme before the first paint (IndexedDB is async). Keep the key and
 * colours below in sync with that script.
 */
export const THEME_STORAGE_KEY = '75hard-theme'

/** Browser-chrome colours: the canvas colour of each theme. */
const THEME_COLORS = { light: '#fbfbf8', dark: '#14181a' } as const

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark'
}

export function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function resolveTheme(preference: ThemePreference, prefersDark: boolean): 'light' | 'dark' {
  return preference === 'system' ? (prefersDark ? 'dark' : 'light') : preference
}

/** Applies a theme to <html> (`.dark` class and color-scheme) and to the theme-color meta tags. */
export function applyTheme(preference: ThemePreference): void {
  const theme = resolveTheme(preference, systemPrefersDark())
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme

  // With "system" each meta keeps following its media query; a forced theme overrides both.
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const media = meta.getAttribute('media') ?? ''
    const ownScheme = media.includes('dark') ? 'dark' : 'light'
    meta.content = THEME_COLORS[preference === 'system' ? ownScheme : theme]
  }
}

export function mirrorThemePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // Storage can be unavailable (private mode, blocked site data); the theme still applies this session.
  }
}

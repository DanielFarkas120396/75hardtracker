import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect } from 'react'
import { SETTING_KEYS, settingsRepo } from '../db/repositories/settingsRepo'
import { applyTheme, isThemePreference, mirrorThemePreference, type ThemePreference } from '../lib/theme'

/** The saved theme preference (defaults to following the system), and a setter. `undefined` while loading. */
export function useThemeSetting() {
  const stored = useLiveQuery(() => settingsRepo.get<unknown>(SETTING_KEYS.theme, 'system'), [])
  const preference: ThemePreference | undefined =
    stored === undefined ? undefined : isThemePreference(stored) ? stored : 'system'

  const setPreference = useCallback((value: ThemePreference) => settingsRepo.set(SETTING_KEYS.theme, value), [])
  return { preference, setPreference }
}

/**
 * Keeps <html> in sync with the saved theme — and, for "system", with the
 * OS setting as it changes. Mirrors the preference to localStorage for the
 * no-flash script in index.html. Mount once, at the app root.
 */
export function useApplyTheme(): void {
  const { preference } = useThemeSetting()

  useEffect(() => {
    // Until the setting loads, the inline script's choice stays in place.
    if (!preference) return
    applyTheme(preference)
    mirrorThemePreference(preference)
    if (preference !== 'system') return

    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system')
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [preference])
}

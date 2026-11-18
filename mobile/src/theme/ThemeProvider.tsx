import { dayNumberForDate, todayISO } from '@logic/dates'
import { SETTING_KEYS } from '@logic/settingKeys'
import { isThemePreference, resolveTheme } from '@logic/theme'
import { worldForProgress, type WorldId } from '@logic/worlds'
import { createContext, useContext, type ReactNode } from 'react'
import { useColorScheme } from 'react-native'
import { challengeRepo } from '../db/repositories/challengeRepo'
import { settingsRepo } from '../db/repositories/settingsRepo'
import { useLiveQuery } from '../db/useLiveQuery'
import { FONTS, SYSTEM_FONTS, useAppFonts, type AppFonts, type FontStatus } from './fonts'
import { colorsFor, type ThemeColors, type ThemeMode } from './tokens'

export interface Theme {
  mode: ThemeMode
  /** The world whose colours the app wears: the one the current attempt's day is in. */
  world: WorldId
  colors: ThemeColors
  fonts: AppFonts
  fontStatus: FontStatus
}

const ThemeContext = createContext<Theme | null>(null)

/**
 * The Ember look for everything inside: light or dark (the saved preference,
 * else the phone's), the current world's colours, and the fonts. Needs the
 * database to be open.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const phoneIsDark = useColorScheme() === 'dark'
  const saved = useLiveQuery(() => settingsRepo.get<unknown>(SETTING_KEYS.theme, 'system'), [])
  const challenge = useLiveQuery(() => challengeRepo.getCurrent(), [])
  const fontStatus = useAppFonts()

  const mode = resolveTheme(isThemePreference(saved) ? saved : 'system', phoneIsDark)
  // ponytail: the day is read when this renders, so the world changes at the next render after
  // midnight, not on the stroke. A ticking "today" arrives with the Today screen.
  const day = challenge ? dayNumberForDate(challenge.startDate, todayISO()) : null
  const world = worldForProgress(day, challenge?.status === 'completed')

  const theme: Theme = {
    mode,
    world,
    colors: colorsFor(world, mode),
    fonts: fontStatus === 'ready' ? FONTS : SYSTEM_FONTS,
    fontStatus,
  }
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext)
  if (theme === null) throw new Error('useTheme needs a ThemeProvider above it.')
  return theme
}

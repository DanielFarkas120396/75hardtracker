import * as SplashScreen from 'expo-splash-screen'
import { useEffect, useState, type ReactNode } from 'react'
import { openAppDatabase } from '../db/open'
import { ThemeProvider, useTheme } from '../theme/ThemeProvider'
import { DatabaseError } from './DatabaseError'

type Opening = { status: 'opening' } | { status: 'open' } | { status: 'failed'; message: string }

/**
 * Everything the screens need before they can render: the database, then the
 * theme and fonts. The splash screen stays up meanwhile. If the database can't
 * be opened, an error screen says so instead of a blank app.
 */
export function AppGate({ children }: { children: ReactNode }) {
  const [opening, setOpening] = useState<Opening>({ status: 'opening' })

  useEffect(() => {
    let gone = false
    openAppDatabase().then(
      () => {
        if (!gone) setOpening({ status: 'open' })
      },
      (error: unknown) => {
        if (!gone) setOpening({ status: 'failed', message: error instanceof Error ? error.message : String(error) })
      },
    )
    return () => {
      gone = true
    }
  }, [])

  if (opening.status === 'opening') return null
  if (opening.status === 'failed') {
    void SplashScreen.hideAsync()
    return <DatabaseError message={opening.message} />
  }
  return (
    <ThemeProvider>
      <WhenFontsSettle>{children}</WhenFontsSettle>
    </ThemeProvider>
  )
}

/** Holds the splash screen until the fonts are loaded, or have failed (the app then uses the system font). */
function WhenFontsSettle({ children }: { children: ReactNode }) {
  const { fontStatus } = useTheme()
  const settled = fontStatus !== 'loading'
  useEffect(() => {
    if (settled) void SplashScreen.hideAsync()
  }, [settled])
  return settled ? children : null
}

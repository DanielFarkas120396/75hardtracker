import { lazy, Suspense, useState } from 'react'
import { BadgeUnlockToast } from './components/BadgeUnlockToast'
import { TimeTravelBadge } from './dev/TimeTravelBadge'
import { BottomNav, type ScreenId } from './components/ui/BottomNav'
import { useBadgeUnlocks } from './hooks/useBadgeUnlocks'
import { canGiveUp, useChallengeGate } from './hooks/useChallengeGate'
import { useDayCompleteCelebration } from './hooks/useDayCompleteCelebration'
import { useApplyTheme } from './hooks/useThemePreference'
import { useToday } from './hooks/useToday'
import { useWorldTheme } from './hooks/useWorldTheme'
import { worldForProgress } from './lib/worldTheme'
import { OnboardingGate } from './screens/Onboarding/OnboardingGate'
import { DayCompleteCelebration } from './screens/Today/DayCompleteCelebration'
import { TodayScreen } from './screens/Today/TodayScreen'

// Everything but Today loads on first use, keeping the startup bundle small.
// The service worker precaches these chunks, so they still work offline.
const JourneyScreen = lazy(() => import('./screens/Journey/JourneyScreen').then((m) => ({ default: m.JourneyScreen })))
const StatsScreen = lazy(() => import('./screens/Stats/StatsScreen').then((m) => ({ default: m.StatsScreen })))
const GalleryScreen = lazy(() => import('./screens/Gallery/GalleryScreen').then((m) => ({ default: m.GalleryScreen })))
const SettingsScreen = lazy(() =>
  import('./screens/Settings/SettingsScreen').then((m) => ({ default: m.SettingsScreen })),
)
const DayFailedScreen = lazy(() =>
  import('./screens/RestartFlow/DayFailedScreen').then((m) => ({ default: m.DayFailedScreen })),
)
const JokerUsedScreen = lazy(() =>
  import('./screens/RestartFlow/JokerUsedScreen').then((m) => ({ default: m.JokerUsedScreen })),
)
const GaveUpScreen = lazy(() => import('./screens/RestartFlow/GaveUpScreen').then((m) => ({ default: m.GaveUpScreen })))
const VictoryScreen = lazy(() => import('./screens/Victory/VictoryScreen').then((m) => ({ default: m.VictoryScreen })))

function LoadingScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas">
      <p className="font-rounded text-ink-muted">Loading…</p>
    </div>
  )
}

function App() {
  useApplyTheme()
  const today = useToday()

  return (
    <OnboardingGate today={today} loading={<LoadingScreen />}>
      <MainApp today={today} />
    </OnboardingGate>
  )
}

/** The app once the player has a profile: the challenge gate, the screens and the bottom nav. */
function MainApp({ today }: { today: string }) {
  const [screen, setScreen] = useState<ScreenId>('today')
  // Set by the Gallery's "take a photo": Today opens its camera once, then clears it.
  const [cameraRequested, setCameraRequested] = useState(false)
  const goTo = (id: ScreenId) => {
    setCameraRequested(false)
    setScreen(id)
  }
  const gate = useChallengeGate(today)
  const { celebration, dismiss: dismissCelebration } = useDayCompleteCelebration(gate)
  const { toasts, dismiss: dismissToast } = useBadgeUnlocks(gate)
  // The app wears the colours of the Journey world you're in.
  useWorldTheme(gate ? worldForProgress(gate.todayDayNumber, gate.kind === 'completed') : undefined)

  // Giving up happens from Settings: the next attempt should open on Today, not back there.
  if (gate?.kind === 'abandoned' && screen !== 'today') setScreen('today')

  if (!gate) return <LoadingScreen />

  if (gate.kind === 'needsRestart') {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <DayFailedScreen challenge={gate.challenge} failedDayNumber={gate.failedDayNumber} today={today} />
      </Suspense>
    )
  }

  if (gate.kind === 'jokerUsed') {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <JokerUsedScreen
          challenge={gate.challenge}
          newlyMissed={gate.newlyMissed}
          missedCount={gate.missedDays.length}
          jokersLeft={gate.jokersLeft}
        />
      </Suspense>
    )
  }

  if (gate.kind === 'abandoned') {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <GaveUpScreen challenge={gate.challenge} today={today} />
      </Suspense>
    )
  }

  return (
    <>
      {/* A phone-width column: on a wide screen the app stays readable instead of stretching. */}
      <div className="mx-auto max-w-md">
        <Suspense fallback={<LoadingScreen />}>
          {screen === 'today' &&
            (gate.kind === 'completed' ? (
              <VictoryScreen
                challenge={gate.challenge}
                today={today}
                revealed={celebration === null}
                streak={gate.streak}
                missedDays={gate.missedDays}
              />
            ) : (
              <TodayScreen
                challenge={gate.challenge}
                dayEntries={gate.dayEntries}
                today={today}
                todayDayNumber={gate.todayDayNumber}
                streak={gate.streak}
                jokersLeft={gate.jokersLeft}
                pendingLateDay={gate.lateDayPending ? gate.lateDayNumber : null}
                openCamera={cameraRequested}
                onCameraOpened={() => setCameraRequested(false)}
              />
            ))}
          {screen === 'journey' && (
            <JourneyScreen
              challenge={gate.challenge}
              dayEntries={gate.dayEntries}
              todayDayNumber={gate.todayDayNumber}
              streak={gate.streak}
              completed={gate.kind === 'completed'}
              missedDays={gate.missedDays}
            />
          )}
          {screen === 'stats' && (
            <StatsScreen
              challenge={gate.challenge}
              streak={gate.streak}
              today={today}
              todayDayNumber={gate.todayDayNumber}
              completed={gate.kind === 'completed'}
            />
          )}
          {screen === 'gallery' && (
            <GalleryScreen
              onTakePhoto={() => {
                setScreen('today')
                setCameraRequested(true)
              }}
            />
          )}
          {screen === 'settings' && (
            <SettingsScreen
              challenge={gate.challenge}
              today={today}
              todayDayNumber={gate.todayDayNumber}
              streak={gate.streak}
              canGiveUp={canGiveUp(gate)}
            />
          )}
        </Suspense>
      </div>

      <BottomNav active={screen} onChange={goTo} />
      {import.meta.env.DEV && <TimeTravelBadge />}

      <DayCompleteCelebration celebration={celebration} onDismiss={dismissCelebration} />
      <BadgeUnlockToast badges={toasts} onDismiss={dismissToast} />
    </>
  )
}

export default App

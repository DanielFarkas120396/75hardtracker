import { lazy, Suspense, useState } from 'react'
import { BadgeUnlockToast } from './components/BadgeUnlockToast'
import { BottomNav, type ScreenId } from './components/ui/BottomNav'
import { useBadgeUnlocks } from './hooks/useBadgeUnlocks'
import { useChallengeGate } from './hooks/useChallengeGate'
import { useDayCompleteCelebration } from './hooks/useDayCompleteCelebration'
import { useToday } from './hooks/useToday'
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
const VictoryScreen = lazy(() => import('./screens/Victory/VictoryScreen').then((m) => ({ default: m.VictoryScreen })))

function LoadingScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas">
      <p className="font-rounded text-ink-muted">Loading…</p>
    </div>
  )
}

function App() {
  const [screen, setScreen] = useState<ScreenId>('today')
  const today = useToday()
  const gate = useChallengeGate(today)
  const { celebration, dismiss: dismissCelebration } = useDayCompleteCelebration(gate)
  const { toasts, dismiss: dismissToast } = useBadgeUnlocks(gate)

  if (!gate) return <LoadingScreen />

  if (gate.kind === 'needsRestart') {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <DayFailedScreen challenge={gate.challenge} failedDayNumber={gate.failedDayNumber} today={today} />
      </Suspense>
    )
  }

  return (
    <>
      <Suspense fallback={<LoadingScreen />}>
        {screen === 'today' &&
          (gate.kind === 'completed' ? (
            <VictoryScreen challenge={gate.challenge} today={today} revealed={celebration === null} />
          ) : (
            <TodayScreen
              challenge={gate.challenge}
              dayEntries={gate.dayEntries}
              today={today}
              todayDayNumber={gate.todayDayNumber}
              streak={gate.streak}
            />
          ))}
        {screen === 'journey' && (
          <JourneyScreen
            challenge={gate.challenge}
            dayEntries={gate.dayEntries}
            todayDayNumber={gate.todayDayNumber}
            streak={gate.streak}
            completed={gate.kind === 'completed'}
          />
        )}
        {screen === 'stats' && <StatsScreen challenge={gate.challenge} streak={gate.streak} />}
        {screen === 'gallery' && <GalleryScreen />}
        {screen === 'settings' && (
          <SettingsScreen challenge={gate.challenge} today={today} todayDayNumber={gate.todayDayNumber} />
        )}
      </Suspense>

      <BottomNav active={screen} onChange={setScreen} />

      <DayCompleteCelebration celebration={celebration} onDismiss={dismissCelebration} />
      <BadgeUnlockToast badges={toasts} onDismiss={dismissToast} />
    </>
  )
}

export default App

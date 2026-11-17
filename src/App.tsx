import { lazy, Suspense, useEffect, useState } from 'react'
import { DuckArt } from './components/mascot/duckArt'
import { ToastStack, type Toast } from './components/ToastStack'
import { TimeTravelBadge } from './dev/TimeTravelBadge'
import { BottomNav, type ScreenId } from './components/ui/BottomNav'
import { useBadgeUnlocks } from './hooks/useBadgeUnlocks'
import { useSaveFailure } from './hooks/useSaveFailure'
import { canGiveUp, useChallengeGate } from './hooks/useChallengeGate'
import { useDayCompleteCelebration } from './hooks/useDayCompleteCelebration'
import { useAppLock } from './hooks/useAppLock'
import { useApplyTheme } from './hooks/useThemePreference'
import { useToday } from './hooks/useToday'
import { useWorldTheme } from './hooks/useWorldTheme'
import type { BadgeDefinition } from './logic/badges'
import { worldForProgress } from './lib/worldTheme'
import { OnboardingGate } from './screens/Onboarding/OnboardingGate'
import { DayCompleteCelebration } from './screens/Today/DayCompleteCelebration'
import { LockScreen } from './screens/Lock/LockScreen'
import { useSettledCelebration } from './screens/Today/fills/boardSettle'
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

/** A still duck while the app opens, instead of a bare word flashing past. */
function LoadingScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas" role="status">
      <DuckArt size={96} />
      <span className="sr-only">Loading…</span>
    </div>
  )
}

/** The badges waiting to be shown, reported up by MainApp so they share one stack with the app-wide toasts. */
interface BadgeFeed {
  badges: BadgeDefinition[]
  dismiss: (badgeId: string) => void
}
const NO_BADGES: BadgeFeed = { badges: [], dismiss: () => {} }

const SAVE_ERROR_ID = 'save-error'
const BADGE_PREFIX = 'badge:'

function App() {
  useApplyTheme()
  const today = useToday()
  const lock = useAppLock()
  const saveFailure = useSaveFailure()
  const [badgeFeed, setBadgeFeed] = useState<BadgeFeed>(NO_BADGES)

  // One stack for every toast: a failed save in front, then the badges. Badges stay hidden under the lock.
  const toasts: Toast[] = [
    ...(saveFailure.failures > 0
      ? [
          {
            id: SAVE_ERROR_ID,
            title: "Couldn't save that",
            detail: 'Try again. If it keeps happening, your phone may be full.',
            error: true,
            durationMs: 6000,
            stamp: saveFailure.failures,
          },
        ]
      : []),
    ...(lock.status === 'locked'
      ? []
      : badgeFeed.badges.map((badge) => ({
          id: BADGE_PREFIX + badge.id,
          title: `Badge unlocked: ${badge.name}`,
          detail: badge.description,
          durationMs: 4500,
        }))),
  ]
  const dismissToast = (id: string) => (id === SAVE_ERROR_ID ? saveFailure.dismiss() : badgeFeed.dismiss(id.slice(BADGE_PREFIX.length)))

  if (lock.status === 'loading') return <LoadingScreen />
  return (
    <>
      {/* Under the app lock the app stays mounted (you come back where you were) but hidden and inert. */}
      <div inert={lock.status === 'locked'} className={lock.status === 'locked' ? 'invisible' : undefined}>
        <OnboardingGate today={today} loading={<LoadingScreen />}>
          <MainApp today={today} onBadgeFeed={setBadgeFeed} />
        </OnboardingGate>
      </div>
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      {lock.status === 'locked' && (
        <LockScreen
          faceIdEnabled={lock.faceIdEnabled}
          failures={lock.failures}
          onFaceId={lock.unlockWithFaceId}
          onPin={lock.unlockWithPin}
          onConfirmFaceId={lock.confirmFaceId}
          onResetPin={lock.resetPinAndUnlock}
          onBypass={lock.bypass}
        />
      )}
    </>
  )
}

/** The app once the player has a profile: the challenge gate, the screens and the bottom nav. */
function MainApp({ today, onBadgeFeed }: { today: string; onBadgeFeed: (feed: BadgeFeed) => void }) {
  const [screen, setScreen] = useState<ScreenId>('today')
  // Set by the Gallery's "take a photo": Today opens its camera once, then clears it.
  const [cameraRequested, setCameraRequested] = useState(false)
  const goTo = (id: ScreenId) => {
    setCameraRequested(false)
    setScreen(id)
  }
  const gate = useChallengeGate(today)
  const { celebration, dismiss: dismissCelebration } = useDayCompleteCelebration(gate)
  // "Day complete!" waits for the board's last chip to land (5 s at most).
  const shownCelebration = useSettledCelebration(celebration)
  const { toasts, dismiss: dismissToast } = useBadgeUnlocks(gate)
  // Badges wait for the day-complete celebration to be dismissed: one peak at a time.
  const badgesPaused = celebration !== null
  useEffect(() => onBadgeFeed({ badges: badgesPaused ? [] : toasts, dismiss: dismissToast }), [toasts, badgesPaused, dismissToast, onBadgeFeed])
  useEffect(() => () => onBadgeFeed(NO_BADGES), [onBadgeFeed])
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
                celebrating={celebration !== null}
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
              attemptNumber={gate.challenge.attemptNumber}
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

      <DayCompleteCelebration celebration={shownCelebration} onDismiss={dismissCelebration} />
    </>
  )
}

export default App

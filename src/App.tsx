import { useState } from 'react'
import { BadgeUnlockToast } from './components/BadgeUnlockToast'
import { BottomNav, type ScreenId } from './components/ui/BottomNav'
import { useBadgeUnlocks } from './hooks/useBadgeUnlocks'
import { useChallengeGate } from './hooks/useChallengeGate'
import { useDayCompleteCelebration } from './hooks/useDayCompleteCelebration'
import { useToday } from './hooks/useToday'
import { GalleryScreen } from './screens/Gallery/GalleryScreen'
import { DayFailedScreen } from './screens/RestartFlow/DayFailedScreen'
import { JourneyScreen } from './screens/Journey/JourneyScreen'
import { SettingsScreen } from './screens/Settings/SettingsScreen'
import { StatsScreen } from './screens/Stats/StatsScreen'
import { DayCompleteCelebration } from './screens/Today/DayCompleteCelebration'
import { TodayScreen } from './screens/Today/TodayScreen'
import { VictoryScreen } from './screens/Victory/VictoryScreen'

function App() {
  const [screen, setScreen] = useState<ScreenId>('today')
  const today = useToday()
  const gate = useChallengeGate(today)
  const { celebration, dismiss: dismissCelebration } = useDayCompleteCelebration(gate)
  const { toasts, dismiss: dismissToast } = useBadgeUnlocks(gate)

  if (!gate) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas">
        <p className="font-rounded text-ink-muted">Loading…</p>
      </div>
    )
  }

  if (gate.kind === 'needsRestart') {
    return <DayFailedScreen challenge={gate.challenge} failedDayNumber={gate.failedDayNumber} today={today} />
  }

  return (
    <>
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

      <BottomNav active={screen} onChange={setScreen} />

      <DayCompleteCelebration celebration={celebration} onDismiss={dismissCelebration} />
      <BadgeUnlockToast badges={toasts} onDismiss={dismissToast} />
    </>
  )
}

export default App

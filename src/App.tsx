import { useState } from 'react'
import { BottomNav, type ScreenId } from './components/ui/BottomNav'
import { useActiveChallenge } from './hooks/useActiveChallenge'
import { useChallengeGate } from './hooks/useChallengeGate'
import { GalleryScreen } from './screens/Gallery/GalleryScreen'
import { DayFailedScreen } from './screens/RestartFlow/DayFailedScreen'
import { JourneyScreen } from './screens/Journey/JourneyScreen'
import { SettingsScreen } from './screens/Settings/SettingsScreen'
import { StatsScreen } from './screens/Stats/StatsScreen'
import { TodayScreen } from './screens/Today/TodayScreen'

function App() {
  const [screen, setScreen] = useState<ScreenId>('today')
  const challenge = useActiveChallenge()
  const gate = useChallengeGate(challenge)

  if (!gate) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas">
        <p className="font-rounded text-ink-muted">Loading…</p>
      </div>
    )
  }

  if (gate.needsRestartConfirmation) {
    return (
      <DayFailedScreen challenge={gate.challenge} dayEntries={gate.dayEntries} todayDayNumber={gate.todayDayNumber} />
    )
  }

  return (
    <>
      {screen === 'today' && <TodayScreen />}
      {screen === 'journey' && (
        <JourneyScreen challenge={gate.challenge} dayEntries={gate.dayEntries} todayDayNumber={gate.todayDayNumber} />
      )}
      {screen === 'stats' && <StatsScreen challenge={gate.challenge} />}
      {screen === 'gallery' && <GalleryScreen />}
      {screen === 'settings' && <SettingsScreen challenge={gate.challenge} />}

      <BottomNav active={screen} onChange={setScreen} />
    </>
  )
}

export default App

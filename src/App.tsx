import { useState } from 'react'
import { BottomNav, type ScreenId } from './components/ui/BottomNav'
import { TodayScreen } from './screens/Today/TodayScreen'

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-canvas pb-24 text-center">
      <span className="text-4xl">🚧</span>
      <h1 className="font-rounded text-xl font-extrabold text-ink">{title}</h1>
      <p className="font-rounded text-sm text-ink-muted">Coming in a later milestone.</p>
    </div>
  )
}

function App() {
  const [screen, setScreen] = useState<ScreenId>('today')

  return (
    <>
      {screen === 'today' && <TodayScreen />}
      {screen === 'journey' && <ComingSoon title="Journey" />}
      {screen === 'stats' && <ComingSoon title="Stats" />}
      {screen === 'gallery' && <ComingSoon title="Gallery" />}
      {screen === 'settings' && <ComingSoon title="Settings" />}

      <BottomNav active={screen} onChange={setScreen} />
    </>
  )
}

export default App

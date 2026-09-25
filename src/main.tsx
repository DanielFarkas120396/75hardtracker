import { MotionConfig } from 'framer-motion'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App.tsx'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import { StorageErrorScreen } from './components/StorageErrorScreen'
import { openDatabase } from './db/openDatabase'
import { listenForInstallPrompt } from './lib/installPrompt'
import { unlockAudioOnUserGesture } from './lib/sound'
import { requestPersistenceOnce } from './lib/storage'

// Early: the browser can offer installation before the database is open.
listenForInstallPrompt()
// The chime plays from effects, outside any gesture; the first taps unlock audio for it.
unlockAudioOnUserGesture()

const root = createRoot(document.getElementById('root')!)
let opened = false

openDatabase({
  onBlocked: () => {
    if (!opened) root.render(<StorageErrorScreen problem="blocked" />)
  },
  onSlow: () => {
    if (!opened) root.render(<StorageErrorScreen problem="slow" />)
  },
})
  .then(() => {
    opened = true
    root.render(
      <StrictMode>
        <AppErrorBoundary>
          {/* Honours the OS "reduce motion" setting: Framer drops movement and keeps fades. */}
          <MotionConfig reducedMotion="user">
            <App />
          </MotionConfig>
        </AppErrorBoundary>
      </StrictMode>,
    )
    void requestPersistenceOnce()
  })
  .catch((error: unknown) => {
    root.render(<StorageErrorScreen problem="failed" error={error} />)
  })

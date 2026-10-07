import { useSyncExternalStore } from 'react'
import { Button } from '../../components/ui/Button'
import { getInstallState, promptInstall, subscribeToInstallState } from '../../lib/installPrompt'

/** Offers to install the app to the Home Screen (or explains how, on iPhone). */
export function InstallSection() {
  const state = useSyncExternalStore(subscribeToInstallState, getInstallState)

  return (
    <section className="rounded-card bg-surface p-4 shadow-sm ring-1 ring-ink/10 dark:ring-0">
      <h2 className="font-rounded text-lg font-bold text-ink">Install the app</h2>
      {state === 'installed' && <p className="mt-1 text-sm text-ink-muted">You're using the installed app. ✓</p>}
      {state === 'available' && (
        <>
          <p className="mt-1 text-sm text-ink-muted">
            Put 75 Hard on your Home Screen: it opens full-screen, works offline, and your data is less likely
            to be cleared.
          </p>
          <Button variant="primary" className="mt-3 w-full" onClick={() => void promptInstall()}>
            Install 75 Hard Companion
          </Button>
        </>
      )}
      {state === 'ios' && (
        <p className="mt-1 text-sm text-ink-muted">
          In Safari, tap the Share button, then “Add to Home Screen”. It opens full-screen and works offline.
        </p>
      )}
      {state === 'unavailable' && (
        <p className="mt-1 text-sm text-ink-muted">
          Use your browser's menu → “Install app” or “Add to Home screen” to keep 75 Hard one tap away.
        </p>
      )}
    </section>
  )
}

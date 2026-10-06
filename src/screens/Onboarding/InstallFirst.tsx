import { useState, useSyncExternalStore, type ReactNode } from 'react'
import { Icon } from '../../components/icons/Icon'
import { Mascot } from '../../components/mascot/Mascot'
import { Button } from '../../components/ui/Button'
import {
  getInstallState,
  INSTALL_SKIPPED_KEY,
  promptInstall,
  shouldOfferInstallFirst,
  subscribeToInstallState,
} from '../../lib/installPrompt'

function wasSkipped(): boolean {
  try {
    return localStorage.getItem(INSTALL_SKIPPED_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Before the welcome flow, in a phone browser: install the app first. On
 * iPhone a Home Screen app keeps its own data, apart from Safari's — set up
 * in Safari and the installed app would start empty. Shows `children` (the
 * welcome flow) once installed, elsewhere, or after "Continue anyway".
 */
export function InstallFirst({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(subscribeToInstallState, getInstallState)
  const [skipped, setSkipped] = useState(wasSkipped)
  const [asked, setAsked] = useState(false)

  if (!shouldOfferInstallFirst(state, skipped)) return children

  const skip = () => {
    try {
      localStorage.setItem(INSTALL_SKIPPED_KEY, '1')
    } catch {
      // Storage unavailable: it asks again next time, which is fine.
    }
    setSkipped(true)
  }

  return (
    <div className="min-h-dvh bg-surface">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center px-6 pt-10 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center">
        <Mascot mood="content" size={96} />
        <h1 className="mt-4 font-display text-2xl tracking-wide text-ink">Add 75 Hard to your Home Screen</h1>
        <p className="mt-3 text-ink-muted">
          It opens full screen, works offline, and keeps your progress safe. Start there: on iPhone, the app on your Home
          Screen keeps its own data, apart from Safari.
        </p>

        {state === 'ios' ? (
          <ol className="mt-6 flex w-full flex-col gap-3 text-left">
            <InstallStep number={1}>
              Tap the <strong className="text-ink">Share</strong> button
              <Icon name="share" size={20} className="mx-1 inline align-text-bottom text-world-ink" label="Share" /> in Safari's
              toolbar.
            </InstallStep>
            <InstallStep number={2}>
              Choose <strong className="text-ink">Add to Home Screen</strong> (scroll down the list if needed).
            </InstallStep>
            <InstallStep number={3}>
              Open <strong className="text-ink">75 Hard</strong> from your Home Screen, and set it up there.
            </InstallStep>
          </ol>
        ) : (
          <div className="mt-6 w-full">
            <Button
              className="w-full"
              onClick={() => {
                setAsked(true)
                void promptInstall()
              }}
            >
              Install 75 Hard
            </Button>
            {asked && <p className="mt-3 text-sm text-ink-muted">Then open it from your home screen and set it up there.</p>}
          </div>
        )}

        <button type="button" onClick={skip} className="mt-auto min-h-touch pt-6 font-rounded text-sm font-bold text-ink-muted underline">
          Continue in the browser anyway
        </button>
      </div>
    </div>
  )
}

function InstallStep({ number, children }: { number: number; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3 rounded-2xl bg-world-soft p-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-world font-display text-on-world">
        {number}
      </span>
      <span className="pt-0.5 font-rounded text-sm text-ink-muted">{children}</span>
    </li>
  )
}

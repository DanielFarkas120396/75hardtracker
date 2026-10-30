import { useState, useSyncExternalStore, type ReactNode } from 'react'
import { Icon } from '../../components/icons/Icon'
import { Mascot } from '../../components/mascot/Mascot'
import { Button } from '../../components/ui/Button'
import {
  getInstallState,
  INSTALL_SKIPPED_KEY,
  isAndroid,
  promptInstall,
  shouldOfferInstallFirst,
  subscribeToInstallState,
} from '../../lib/installPrompt'

/** After installing: where to go next, since this browser tab can't follow. */
const OPEN_IT_LINE = 'Now open 75 Hard from your Home Screen and set it up there. You can close this tab.'

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
 * welcome flow) once installed, elsewhere, or after "Continue in Safari".
 */
export function InstallFirst({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(subscribeToInstallState, getInstallState)
  const [skipped, setSkipped] = useState(wasSkipped)
  const [done, setDone] = useState(false)

  if (!shouldOfferInstallFirst(state, skipped)) return children

  const skip = () => {
    try {
      localStorage.setItem(INSTALL_SKIPPED_KEY, '1')
    } catch {
      // Storage unavailable: it asks again next time, which is fine.
    }
    setSkipped(true)
  }

  if (state === 'inApp') return <OpenInBrowser onSkip={skip} />
  const browser = state === 'ios' ? 'Safari' : 'the browser'

  return (
    <div className="min-h-dvh bg-canvas">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center px-6 pt-10 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center">
        <Mascot mood="content" size={96} />
        <h1 className="mt-4 font-display text-2xl tracking-wide text-ink">Add 75 Hard to your Home Screen</h1>
        <p className="mt-3 font-rounded font-bold text-ink">Set it up in the app, not in {browser}. They don't share data.</p>
        <p className="mt-2 text-ink-muted">The app opens full screen and works offline.</p>

        {state === 'ios' ? (
          <>
            <ol className="mt-6 flex w-full flex-col gap-3 text-left">
              <InstallStep number={1}>
                Tap the <strong className="text-ink">Share</strong> button
                <Icon name="share" size={20} className="mx-1 inline align-text-bottom text-world-ink" /> in Safari's
                toolbar.
              </InstallStep>
              <InstallStep number={2}>
                Choose <strong className="text-ink">Add to Home Screen</strong> (scroll down the list if needed).
              </InstallStep>
              <InstallStep number={3}>
                Open <strong className="text-ink">75 Hard</strong> from your Home Screen, and set it up there.
              </InstallStep>
            </ol>
            <Button className="mt-6 w-full" onClick={() => setDone(true)}>
              I've added it
            </Button>
          </>
        ) : (
          <Button
            className="mt-6 w-full"
            onClick={() => {
              setDone(true)
              void promptInstall()
            }}
          >
            Install 75 Hard
          </Button>
        )}
        <p aria-live="polite" className="mt-3 text-sm font-semibold text-ink empty:hidden">
          {done ? OPEN_IT_LINE : ''}
        </p>

        <button type="button" onClick={skip} className="mt-auto min-h-touch pt-6 font-rounded text-sm font-bold text-ink-muted underline">
          Continue in {browser} ({state === 'ios' ? 'Safari' : 'It'} can clear your data if you stop opening it)
        </button>
      </div>
    </div>
  )
}

/** Inside TikTok, Instagram and the like: this page can't be installed from here, so send it to the real browser. */
function OpenInBrowser({ onSkip }: { onSkip: () => void }) {
  const [copied, setCopied] = useState(false)
  const browser = isAndroid() ? 'Chrome' : 'Safari'
  const link = window.location.origin

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      // The link stays on screen to copy by hand.
    }
  }

  return (
    <div className="min-h-dvh bg-canvas">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center px-6 pt-10 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center">
        <Mascot mood="content" size={96} />
        <h1 className="mt-4 font-display text-2xl tracking-wide text-ink">Open this in {browser}</h1>
        <p className="mt-3 font-rounded font-bold text-ink">
          You're inside another app. It can't install 75 Hard, and your days could disappear.
        </p>
        <ol className="mt-6 flex w-full flex-col gap-3 text-left">
          <InstallStep number={1}>
            Tap <strong className="text-ink">Copy link</strong>.
          </InstallStep>
          <InstallStep number={2}>
            Open <strong className="text-ink">{browser}</strong> and paste it in the address bar.
          </InstallStep>
        </ol>
        <Button className="mt-6 w-full" onClick={() => void copy()}>
          {copied ? 'Link copied' : 'Copy link'}
        </Button>
        <p className="mt-3 select-all break-all text-sm text-ink-muted">{link}</p>
        <p className="mt-3 text-sm text-ink-muted">Or look for "Open in browser" in this app's menu.</p>
        <button type="button" onClick={onSkip} className="mt-auto min-h-touch pt-6 font-rounded text-sm font-bold text-ink-muted underline">
          Continue here anyway (your days could be lost)
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

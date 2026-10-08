import { useState } from 'react'
import { Mascot } from '../../components/mascot/Mascot'
import { NewPinFlow } from '../../components/NewPinFlow'
import { Button } from '../../components/ui/Button'
import { SAVE_FAILED_LINE } from '../../content/microcopy'
import { appLockRepo } from '../../db/repositories/appLockRepo'
import { createLockCredential, isAppLockAvailable } from '../../lib/appLock'
import { hashPin } from '../../lib/pin'
import { GateHeading } from '../RestartFlow/GateHeading'

type Stage = 'question' | 'pin' | 'faceId'

const FACE_ID_FAILED_LINE = "Face ID didn't confirm. Try again, or skip it for now."

const LINK_BUTTON =
  'mt-2 min-h-touch w-full touch-manipulation font-rounded font-semibold text-ink-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink disabled:opacity-40'

interface LockOfferProps {
  /** The player's name, for the Face ID passkey. */
  name: string
  /** The offer is over, whichever way: the app takes over. */
  onDone: () => void
}

/**
 * Right after the deal is signed, once: the app lock as an optional screen.
 * A PIN first (the lock's base), then Face ID where the phone has it. The app
 * opens unlocked: useAppLock doesn't lock a lock turned on mid-session.
 */
export function LockOffer({ name, onDone }: LockOfferProps) {
  const [stage, setStage] = useState<Stage>('question')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // A new key restarts the pad after a failed save.
  const [padKey, setPadKey] = useState(0)

  const savePin = async (pin: string) => {
    setBusy(true)
    setError(null)
    try {
      await appLockRepo.enable(await hashPin(pin))
      const faceId = await isAppLockAvailable()
      setBusy(false)
      if (faceId) setStage('faceId')
      else onDone()
    } catch {
      setBusy(false)
      setError(SAVE_FAILED_LINE)
      setPadKey((key) => key + 1)
    }
  }

  const turnOnFaceId = async () => {
    setBusy(true)
    setError(null)
    try {
      const credentialId = await createLockCredential(name)
      if (credentialId) {
        await appLockRepo.setFaceId(credentialId)
        setBusy(false)
        onDone()
        return
      }
      setError(FACE_ID_FAILED_LINE)
    } catch {
      setError(SAVE_FAILED_LINE)
    }
    setBusy(false)
  }

  return (
    <div className="min-h-dvh bg-canvas">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {/* The flow's top bar height, so the duck stays where it was on the deal. */}
        <span aria-hidden="true" className="min-h-touch" />
        <div className="flex flex-1 flex-col items-center pt-6 text-center">
          <div className="relative isolate">
            <span aria-hidden="true" className="world-glow pointer-events-none absolute -inset-x-44 -top-28 -bottom-12 -z-10" />
            <Mascot mood="content" size={stage === 'pin' ? 64 : 96} />
          </div>

          {stage === 'question' && (
            <>
              <div className="mt-4">
                <GateHeading>Keep it private?</GateHeading>
              </div>
              <p className="mt-3 text-ink-muted">
                Your photos, weight and notes stay on this phone. A PIN keeps them hidden from anyone holding it.
              </p>
              <Button className="mt-8 w-full" onClick={() => setStage('pin')}>
                Set a PIN
              </Button>
              <button type="button" className={LINK_BUTTON} onClick={onDone}>
                Not now
              </button>
              <p className="mt-4 text-sm text-ink-muted">You can turn it on later in Settings → Privacy &amp; data.</p>
            </>
          )}

          {stage === 'pin' && (
            <div className="mt-4 w-full">
              <NewPinFlow key={padKey} onDone={(pin) => void (busy ? undefined : savePin(pin))} />
              {busy && <p className="mt-2 text-sm text-ink-muted">Saving…</p>}
              {error && <Alert>{error}</Alert>}
              <Button
                variant="secondary"
                className="mt-4 w-full"
                disabled={busy}
                onClick={() => {
                  setError(null)
                  setStage('question')
                }}
              >
                Cancel
              </Button>
            </div>
          )}

          {stage === 'faceId' && (
            <>
              <div className="mt-4">
                <GateHeading>Also unlock with Face ID?</GateHeading>
              </div>
              {error && <Alert>{error}</Alert>}
              <Button className="mt-8 w-full" disabled={busy} onClick={() => void turnOnFaceId()}>
                Turn on Face ID
              </Button>
              <button type="button" className={LINK_BUTTON} disabled={busy} onClick={onDone}>
                Not now
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Alert({ children }: { children: string }) {
  return (
    <p role="alert" className="mt-3 text-sm font-semibold text-danger-ink">
      {children}
    </p>
  )
}

import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { Icon } from '../../components/icons/Icon'
import { Mascot } from '../../components/mascot/Mascot'
import { NewPinFlow } from '../../components/NewPinFlow'
import { PinPad } from '../../components/PinPad'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import type { PinFailures } from '../../db/repositories/appLockRepo'
import type { PinResult } from '../../hooks/useAppLock'
import { formatCountdown, useCountdown } from '../../hooks/useCountdown'
import { FREE_ATTEMPTS } from '../../lib/pin'

interface LockScreenProps {
  faceIdEnabled: boolean
  failures: PinFailures
  onFaceId: () => Promise<boolean>
  onPin: (pin: string) => Promise<PinResult>
  /** Face ID without opening, for "Forgot PIN?". */
  onConfirmFaceId: () => Promise<boolean>
  onResetPin: (pin: string) => Promise<void>
  /** "Can't unlock?": turns the lock off (leaving a notice) and opens the app. */
  onBypass: () => Promise<void>
}

/**
 * Covers the whole app while the lock is closed, like a banking app: Face ID
 * first (asked once on its own), the PIN pad as the backup. Wrong PINs cost
 * growing waits; "Forgot PIN?" sets a new one after Face ID.
 */
export function LockScreen({ faceIdEnabled, failures, onFaceId, onPin, onConfirmFaceId, onResetPin, onBypass }: LockScreenProps) {
  const [mode, setMode] = useState<'pin' | 'newPin'>('pin')
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [confirmBypass, setConfirmBypass] = useState(false)
  const secondsLeft = useCountdown(failures.lockedUntil)
  const waiting = secondsLeft > 0

  // Face ID straight away, only once (React runs effects twice in development).
  const asked = useRef(false)
  const onOpen = useEffectEvent(() => {
    if (asked.current || !faceIdEnabled) return
    asked.current = true
    void onFaceId()
  })
  useEffect(() => onOpen(), [])

  const submitPin = async (pin: string) => {
    setChecking(true)
    const result = await onPin(pin)
    setChecking(false)
    if (result.ok) return
    const left = FREE_ATTEMPTS - result.failures.count
    setError(left > 0 ? `Wrong PIN. ${left} ${left === 1 ? 'try' : 'tries'} left before a wait.` : null)
  }

  const forgotPin = async () => {
    setError(null)
    if (await onConfirmFaceId()) setMode('newPin')
    else setError("Face ID didn't confirm. Try again, or use your PIN.")
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 overflow-y-auto bg-canvas px-6 py-8 text-center">
      <Mascot mood="watching" size={80} decorative />
      <h1 className="font-display text-2xl tracking-wide text-ink">75 Hard is locked</h1>

      {mode === 'newPin' ? (
        <NewPinFlow title="Choose a new PIN" onDone={(pin) => void onResetPin(pin)} />
      ) : (
        <PinPad
          title="Enter your PIN"
          disabled={waiting || checking}
          error={waiting ? null : error}
          hint={waiting ? `Too many wrong PINs. Try again in ${formatCountdown(secondsLeft)}.` : checking ? 'Checking…' : null}
          onComplete={(pin) => void submitPin(pin)}
          extraKey={
            faceIdEnabled ? (
              <button
                type="button"
                aria-label="Unlock with Face ID"
                onClick={() => void onFaceId()}
                className="flex h-16 w-16 items-center justify-center rounded-full text-world-ink"
              >
                <Icon name="profile" size={30} />
              </button>
            ) : null
          }
        />
      )}

      <div className="mt-2 flex flex-col items-center">
        {mode === 'pin' && faceIdEnabled && (
          <button type="button" onClick={() => void forgotPin()} className="min-h-touch font-rounded text-sm font-bold text-world-ink">
            Forgot PIN?
          </button>
        )}
        <button
          type="button"
          onClick={() => setConfirmBypass(true)}
          className="min-h-touch font-rounded text-xs font-bold text-ink-muted underline"
        >
          Can't unlock?
        </button>
      </div>

      <Modal open={confirmBypass} onClose={() => setConfirmBypass(false)}>
        <h2 className="font-rounded text-lg font-extrabold text-ink">Turn the lock off?</h2>
        <p className="mt-2 text-sm text-ink-muted">
          This opens the app and turns the lock off. Next time, the app will show that it was turned off this way, so its
          owner knows.
        </p>
        <div className="mt-4 flex gap-2">
          <Button variant="danger" className="flex-1" onClick={() => void onBypass()}>
            Turn off and open
          </Button>
          <Button variant="secondary" className="flex-1" onClick={() => setConfirmBypass(false)}>
            Cancel
          </Button>
        </div>
      </Modal>
    </div>
  )
}

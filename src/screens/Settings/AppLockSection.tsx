import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { NewPinFlow } from '../../components/NewPinFlow'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Toggle } from '../../components/ui/Toggle'
import { appLockRepo } from '../../db/repositories/appLockRepo'
import { useLockSetup } from '../../hooks/useLockSetup'
import { useProfile } from '../../hooks/useProfile'
import { isAppLockAvailable } from '../../lib/appLock'
import { CheckPinPad } from './CheckPinPad'

type Dialog = 'setup' | 'choosePin' | 'changeCheck' | 'changeNew' | 'offCheck'

/**
 * The app lock: a 6-digit PIN, with Face ID as the shortcut. Changing the
 * PIN or turning the lock off asks for the current PIN first.
 */
export function AppLockSection() {
  const config = useLiveQuery(() => appLockRepo.get(), [])
  const profile = useProfile()
  const [faceIdAvailable, setFaceIdAvailable] = useState(false)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const { busy, error, clearError, turnOn, changePin, addFaceId, removeFaceId } = useLockSetup({
    faceIdFailedLine: "Face ID didn't confirm, so it's still off. Try again.",
  })
  // A new key restarts the pad after a failed save.
  const [padKey, setPadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    void isAppLockAvailable().then((value) => {
      if (!cancelled) setFaceIdAvailable(value)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (config === undefined) return null
  const on = config !== null
  const open = (next: Dialog) => {
    clearError()
    setDialog(next)
  }
  const close = () => {
    clearError()
    setDialog(null)
  }

  const savePin = async (pin: string, first: boolean) => {
    if (busy) return
    if (await (first ? turnOn(pin) : changePin(pin))) setDialog(null)
    else setPadKey((key) => key + 1)
  }

  const toggleFaceId = (enable: boolean) => (enable ? addFaceId(profile?.name ?? '') : removeFaceId())

  return (
    <section className="rounded-card bg-surface p-4 ring-1 ring-ink/10 dark:ring-0">
      <p className="text-sm text-ink-muted">
        Lock the app with a 6-digit PIN, and Face ID as the shortcut. It asks when the app opens and when you come back
        after more than a minute away. Your photos, weight and notes stay hidden until then, even in the app switcher.
      </p>

      {!on ? (
        <Button className="mt-3 w-full" onClick={() => open('setup')}>
          Turn on the app lock
        </Button>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {!config.pin && (
            <div className="rounded-2xl bg-world-soft p-3">
              <p className="text-sm font-semibold text-ink">Choose a PIN, for when Face ID can't unlock the app.</p>
              <Button className="mt-2 w-full" onClick={() => open('choosePin')}>
                Choose a PIN
              </Button>
            </div>
          )}
          {(faceIdAvailable || config.credentialId) && (
            <Toggle
              checked={config.credentialId !== undefined}
              onChange={(enable) => void (busy ? undefined : toggleFaceId(enable))}
              label="Also unlock with Face ID"
            />
          )}
          {config.pin && (
            <Button variant="secondary" onClick={() => open('changeCheck')}>
              Change PIN
            </Button>
          )}
          <Button variant="secondary" onClick={() => (config.pin ? open('offCheck') : void appLockRepo.disable())}>
            Turn off the app lock
          </Button>
        </div>
      )}
      {error && dialog === null && (
        <p role="alert" className="mt-2 text-sm font-semibold text-danger-ink">
          {error}
        </p>
      )}

      <p className="mt-3 text-xs text-ink-muted">
        The PIN is never stored as typed, and never leaves this phone, not even in backups. It's a privacy lock, not
        encryption: it keeps the app closed to someone holding your phone.
      </p>

      <Modal open={dialog !== null} onClose={close}>
        <div className="py-2">
          {dialog === 'setup' && <NewPinFlow key={padKey} onDone={(pin) => void savePin(pin, true)} />}
          {dialog === 'choosePin' && <NewPinFlow key={padKey} onDone={(pin) => void savePin(pin, false)} />}
          {dialog === 'changeCheck' && <CheckPinPad title="Enter your current PIN" onVerified={() => setDialog('changeNew')} />}
          {dialog === 'changeNew' && <NewPinFlow key={padKey} title="Choose a new PIN" onDone={(pin) => void savePin(pin, false)} />}
          {dialog === 'offCheck' && (
            <CheckPinPad
              title="Enter your PIN to turn the lock off"
              onVerified={() => void appLockRepo.disable().then(close)}
            />
          )}
          {busy && <p className="mt-2 text-center text-sm text-ink-muted">Saving…</p>}
          {error && (
            <p role="alert" className="mt-2 text-center text-sm font-semibold text-danger-ink">
              {error}
            </p>
          )}
          <Button variant="secondary" className="mt-4 w-full" onClick={close}>
            Cancel
          </Button>
        </div>
      </Modal>
    </section>
  )
}

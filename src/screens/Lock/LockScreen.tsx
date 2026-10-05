import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { Icon } from '../../components/icons/Icon'
import { Mascot } from '../../components/mascot/Mascot'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'

interface LockScreenProps {
  /** Asks for Face ID; resolves to whether it passed. */
  onUnlock: () => Promise<boolean>
  /** "Can't unlock?": turns the lock off (leaving a notice) and opens the app. */
  onBypass: () => Promise<void>
}

/**
 * Covers the whole app while the Face ID lock is closed. It asks for Face ID
 * once on its own; the button asks again (iOS offers the passcode when Face
 * ID fails).
 */
export function LockScreen({ onUnlock, onBypass }: LockScreenProps) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [confirmBypass, setConfirmBypass] = useState(false)

  const tryUnlock = async () => {
    setBusy(true)
    const ok = await onUnlock()
    setBusy(false)
    setFailed(!ok)
  }

  // Asks straight away; if the browser wants a tap first (or it's cancelled), the button is there.
  // Only once, even when React runs effects twice in development: two Face ID requests would cancel each other.
  const asked = useRef(false)
  const onOpen = useEffectEvent(() => {
    if (asked.current) return
    asked.current = true
    void onUnlock()
  })
  useEffect(() => onOpen(), [])

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
      <Mascot mood="watching" size={130} decorative />
      <h1 className="font-display text-3xl tracking-wide text-ink">75 Hard is locked</h1>
      <p className="max-w-xs font-rounded text-sm text-ink-muted">Your photos and progress stay private.</p>

      <Button onClick={() => void tryUnlock()} disabled={busy} className="mt-2 flex items-center gap-2">
        <Icon name="lock" size={20} />
        {busy ? 'Checking…' : 'Unlock with Face ID'}
      </Button>
      {failed && (
        <p role="alert" className="max-w-xs font-rounded text-sm font-semibold text-danger-ink">
          That didn't work. Try again: iOS will offer your passcode too.
        </p>
      )}

      <button
        type="button"
        onClick={() => setConfirmBypass(true)}
        className="mt-6 min-h-touch font-rounded text-sm font-bold text-ink-muted underline"
      >
        Can't unlock?
      </button>

      <Modal open={confirmBypass} onClose={() => setConfirmBypass(false)}>
        <h2 className="font-rounded text-lg font-extrabold text-ink">Turn the lock off?</h2>
        <p className="mt-2 text-sm text-ink-muted">
          This opens the app and turns the Face ID lock off. Next time, the app will show that it was turned off this
          way, so its owner knows.
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

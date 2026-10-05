import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Toggle } from '../../components/ui/Toggle'
import { appLockRepo } from '../../db/repositories/appLockRepo'
import { useProfile } from '../../hooks/useProfile'
import { createLockCredential, isAppLockAvailable, verifyOwner } from '../../lib/appLock'

/** Turns the Face ID lock on or off. Both ask for Face ID, so an open phone can't quietly switch it off. */
export function AppLockSection() {
  const config = useLiveQuery(() => appLockRepo.get(), [])
  const profile = useProfile()
  const [available, setAvailable] = useState<boolean | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void isAppLockAvailable().then((value) => {
      if (!cancelled) setAvailable(value)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const enabled = config !== undefined && config !== null

  const toggle = async (on: boolean) => {
    setBusy(true)
    setError(null)
    if (on) {
      const credentialId = await createLockCredential(profile?.name ?? '')
      if (credentialId) await appLockRepo.enable(credentialId)
      else setError("Face ID didn't confirm, so the lock is still off. Try again.")
    } else if (config) {
      if (await verifyOwner(config.credentialId)) await appLockRepo.disable()
      else setError("Face ID didn't confirm, so the lock is still on.")
    }
    setBusy(false)
  }

  return (
    <section className="rounded-card bg-surface p-4 shadow-sm ring-1 ring-ink/10 dark:ring-0">
      <p className="text-sm text-ink-muted">
        Ask for Face ID when the app opens, and when you come back after more than a minute away. Your photos, weight and
        notes stay hidden until then, even in the app switcher.
      </p>

      {available === false && !enabled ? (
        <p className="mt-3 rounded-2xl bg-canvas p-3 text-sm text-ink-muted">
          Face ID isn't available here. It works in the installed app on iPhone, opened from its real web address (not a
          local test link).
        </p>
      ) : (
        <div className="mt-3">
          <Toggle checked={enabled} onChange={(on) => void (busy ? undefined : toggle(on))} label="Lock with Face ID" />
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm font-semibold text-danger-ink">
          {error}
        </p>
      )}

      <p className="mt-3 text-xs text-ink-muted">
        A privacy lock, not encryption: it keeps the app closed to someone holding your phone. If Face ID ever can't
        unlock it, “Can't unlock?” turns it off and leaves a notice.
      </p>
    </section>
  )
}

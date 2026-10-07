import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { appLockRepo } from '../db/repositories/appLockRepo'

/** The tripwire: the app lock was turned off through "Can't unlock?". Shown on Today until dismissed. */
export function LockBypassBanner() {
  const bypassedAt = useLiveQuery(() => appLockRepo.getBypassedAt(), [])
  if (!bypassedAt) return null

  return (
    <section role="status" className="mx-4 mb-4 rounded-card bg-danger/10 p-4 ring-1 ring-danger/30">
      <p className="font-rounded text-sm font-bold text-ink">
        🔓 The app lock was turned off on {format(new Date(bypassedAt), 'MMM d, HH:mm')} with “Can't unlock?”.
      </p>
      <p className="mt-1 font-rounded text-sm text-ink-muted">Wasn't you? Turn it back on in Settings → App lock.</p>
      <button
        type="button"
        onClick={() => void appLockRepo.dismissBypassNotice()}
        className="mt-2 min-h-touch rounded-2xl bg-surface px-4 font-rounded text-sm font-bold text-ink"
      >
        Got it
      </button>
    </section>
  )
}

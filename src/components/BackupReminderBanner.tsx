import { useBackupExport } from '../hooks/useBackupExport'
import { useBackupReminder } from '../hooks/useBackupReminder'
import { Button } from './ui/Button'

/** Sunday-evening nudge to export a backup — everything lives only on this device. */
export function BackupReminderBanner() {
  const { visible, snooze } = useBackupReminder()
  const { busy, error, pendingShare, exportNow, shareNow } = useBackupExport()

  if (!visible) return null

  return (
    <section role="region" aria-label="Backup reminder" className="mx-4 mb-4 rounded-card bg-surface p-4 shadow-sm">
      <h2 className="font-rounded text-base font-extrabold text-ink">💾 Sunday backup time</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Your data only lives on this phone. Save a backup file so a lost phone doesn’t cost you your streak.
      </p>
      <div className="mt-3 flex gap-2">
        {pendingShare ? (
          <Button variant="primary" className="flex-1" onClick={() => void shareNow(pendingShare)}>
            Share backup file
          </Button>
        ) : (
          <Button variant="primary" className="flex-1" onClick={() => void exportNow()} disabled={busy}>
            {busy ? 'Preparing backup…' : 'Export now'}
          </Button>
        )}
        <Button variant="secondary" className="flex-1" onClick={() => void snooze()} disabled={busy}>
          Later
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm font-semibold text-danger-ink">
          {error}
        </p>
      )}
    </section>
  )
}

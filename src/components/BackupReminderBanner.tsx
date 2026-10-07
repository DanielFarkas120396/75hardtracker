import { useState } from 'react'
import { useBackupReminder } from '../hooks/useBackupReminder'
import { BackupExportSheet } from './BackupExportSheet'
import { Button } from './ui/Button'

/** Sunday-evening nudge to save a backup — everything lives only on this device. */
export function BackupReminderBanner() {
  const { visible, snooze } = useBackupReminder()
  const [saving, setSaving] = useState(false)

  if (!visible && !saving) return null

  return (
    <>
      {visible && (
        <section role="region" aria-label="Backup reminder" className="mx-4 mb-4 rounded-card bg-surface p-4 shadow-sm">
          <h2 className="font-rounded text-base font-bold text-ink">💾 Sunday backup time</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Your data only lives on this phone. Save a backup to iCloud Drive so a lost phone doesn’t cost you your streak.
          </p>
          <div className="mt-3 flex gap-2">
            <Button variant="primary" className="flex-1" onClick={() => setSaving(true)}>
              Save backup
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => void snooze()}>
              Later
            </Button>
          </div>
        </section>
      )}
      <BackupExportSheet open={saving} onClose={() => setSaving(false)} />
    </>
  )
}

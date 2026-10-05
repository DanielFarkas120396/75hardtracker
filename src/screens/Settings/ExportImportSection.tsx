import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { BackupExportSheet } from '../../components/BackupExportSheet'
import { BackupRestore } from '../../components/BackupRestore'
import { Button } from '../../components/ui/Button'
import { SETTING_KEYS, settingsRepo } from '../../db/repositories/settingsRepo'
import { dayNumberForDate, todayISO } from '../../lib/dates'
import { STALE_BACKUP_DAYS } from '../../logic/backupReminder'
import { formatBytes, getStorageStatus, requestPersistence, type StorageStatus } from '../../lib/storage'

interface ExportImportSectionProps {
  today: string
}

function lastBackupLabel(lastExportAt: string | null, today: string): { text: string; stale: boolean } {
  if (!lastExportAt) return { text: 'No backup yet', stale: true }
  const exportedOn = todayISO(new Date(lastExportAt))
  const daysAgo = dayNumberForDate(exportedOn, today) - 1
  if (!Number.isFinite(daysAgo)) return { text: 'No backup yet', stale: true }
  const text = daysAgo <= 0 ? 'Last backup: today' : daysAgo === 1 ? 'Last backup: yesterday' : `Last backup: ${daysAgo} days ago`
  return { text, stale: daysAgo >= STALE_BACKUP_DAYS }
}

/**
 * Backup & storage: how much space the app uses and whether the browser
 * may evict it, when the last backup was made, saving a backup (optionally
 * password-protected) and restoring one.
 */
export function ExportImportSection({ today }: ExportImportSectionProps) {
  const [exporting, setExporting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [storage, setStorage] = useState<StorageStatus | null>(null)

  const lastExportAt = useLiveQuery(() => settingsRepo.get<string | null>(SETTING_KEYS.lastExportAt, null), [])
  const backup = lastBackupLabel(lastExportAt ?? null, today)

  useEffect(() => {
    let cancelled = false
    void getStorageStatus().then((status) => {
      if (!cancelled) setStorage(status)
    })
    return () => {
      cancelled = true
    }
  }, [lastExportAt])

  const protectStorage = async () => {
    const persisted = await requestPersistence()
    setStorage((current) => ({ ...current, persisted }))
    if (!persisted) setNotice('The browser declined for now. Installing the app to your home screen usually helps.')
  }

  return (
    <section className="rounded-card bg-surface p-4 shadow-sm ring-1 ring-ink/10 dark:ring-0">
      <h2 className="font-rounded text-lg font-extrabold text-ink">Backup & storage</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Everything lives only on this phone. Save a backup now and then — photos included — to iCloud Drive, so a lost
        phone doesn't cost you your progress.
      </p>

      <dl className="mt-3 flex flex-col gap-1 rounded-2xl bg-canvas px-3 py-2 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-ink-muted">Backup</dt>
          <dd className={`font-bold ${backup.stale ? 'text-danger-ink' : 'text-ink'}`}>{backup.text}</dd>
        </div>
        {storage?.usageBytes !== undefined && (
          <div className="flex justify-between gap-2">
            <dt className="text-ink-muted">Storage used</dt>
            <dd className="font-bold text-ink">{formatBytes(storage.usageBytes)}</dd>
          </div>
        )}
        {storage?.persisted !== undefined && (
          <div className="flex justify-between gap-2">
            <dt className="text-ink-muted">Protected from clean-up</dt>
            <dd className="font-bold text-ink">{storage.persisted ? 'Yes ✓' : 'No'}</dd>
          </div>
        )}
      </dl>

      {storage?.persisted === false && (
        <Button variant="secondary" className="mt-2 w-full" onClick={() => void protectStorage()}>
          Ask the browser to keep my data
        </Button>
      )}

      <div className="mt-3 flex flex-col gap-2">
        <Button onClick={() => setExporting(true)}>Save a backup</Button>
        <BackupRestore label="Restore a backup" />
      </div>

      {notice && (
        <p role="status" className="mt-2 text-sm font-semibold text-ink-muted">
          {notice}
        </p>
      )}

      <BackupExportSheet open={exporting} onClose={() => setExporting(false)} />
    </section>
  )
}

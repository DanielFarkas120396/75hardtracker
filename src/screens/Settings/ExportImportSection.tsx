import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { SETTING_KEYS, settingsRepo } from '../../db/repositories/settingsRepo'
import { exportAll, importAll, markExported, validateExportPayload, type ExportPayload } from '../../db/exportImport'
import { saveBackupFile } from '../../lib/backupFile'
import { dayNumberForDate, todayISO } from '../../lib/dates'
import { formatBytes, getStorageStatus, requestPersistence, type StorageStatus } from '../../lib/storage'

/** A backup older than this gets a gentle nudge. */
const STALE_BACKUP_DAYS = 7

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
 * may evict it, when the last backup was made, and JSON export/import
 * (photos included).
 */
export function ExportImportSection({ today }: ExportImportSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pendingImport, setPendingImport] = useState<ExportPayload | null>(null)
  const [pendingShare, setPendingShare] = useState<File | null>(null)
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

  const finishSave = async (file: File, fromFreshTap: boolean) => {
    const outcome = await saveBackupFile(file, { fromFreshTap })
    if (outcome === 'needsGesture') {
      setPendingShare(file)
      return
    }
    setPendingShare(null)
    if (outcome === 'shared' || outcome === 'downloaded') {
      await markExported()
      setNotice(outcome === 'shared' ? 'Backup shared.' : 'Backup downloaded.')
    }
  }

  const handleExport = async () => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const payload = await exportAll()
      const file = new File([JSON.stringify(payload, null, 2)], `75hard-backup-${todayISO()}.json`, {
        type: 'application/json',
      })
      await finishSave(file, false)
    } catch {
      setError('Export failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const handleFileSelected = async (file: File) => {
    setError(null)
    setNotice(null)
    try {
      const parsed: unknown = JSON.parse(await file.text())
      const result = validateExportPayload(parsed)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setPendingImport(result.payload)
    } catch {
      setError('Could not read that file. Make sure it’s a backup exported from this app.')
    }
  }

  const confirmImport = async () => {
    if (!pendingImport) return
    setBusy(true)
    try {
      await importAll(pendingImport)
      window.location.reload()
    } catch {
      setError('Import failed. Your existing data was not changed.')
      setBusy(false)
      setPendingImport(null)
    }
  }

  const protectStorage = async () => {
    const persisted = await requestPersistence()
    setStorage((current) => ({ ...current, persisted }))
    if (!persisted) setNotice('The browser declined for now. Installing the app to your home screen usually helps.')
  }

  return (
    <section className="rounded-card bg-surface p-4 shadow-sm">
      <h2 className="font-rounded text-lg font-extrabold text-ink">💾 Backup & storage</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Everything lives only on this device. Export a backup — photos included — as one file now and then.
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
        <Button variant="secondary" onClick={() => void handleExport()} disabled={busy}>
          {busy && !pendingImport ? 'Preparing backup…' : 'Export backup'}
        </Button>
        {pendingShare && (
          <Button variant="primary" onClick={() => void finishSave(pendingShare, true)}>
            Share backup file
          </Button>
        )}
        <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={busy}>
          Import backup
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleFileSelected(file)
            e.target.value = ''
          }}
        />
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm font-semibold text-danger-ink">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-2 text-sm font-semibold text-ink-muted">
          {notice}
        </p>
      )}

      <Modal open={pendingImport !== null} onClose={() => setPendingImport(null)}>
        <h3 className="font-rounded text-lg font-extrabold text-ink">Replace all data?</h3>
        <p className="mt-2 text-sm text-ink-muted">
          Importing this file will replace everything currently on this device — all attempts, photos, and
          badges — with the contents of the file. This can't be undone.
        </p>
        <div className="mt-4 flex gap-2">
          <Button variant="danger" className="flex-1" onClick={() => void confirmImport()} disabled={busy}>
            {busy ? 'Importing…' : 'Replace data'}
          </Button>
          <Button variant="secondary" className="flex-1" onClick={() => setPendingImport(null)} disabled={busy}>
            Cancel
          </Button>
        </div>
      </Modal>
    </section>
  )
}

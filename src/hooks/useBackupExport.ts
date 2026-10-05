import { useState } from 'react'
import { exportAll, markExported } from '../db/exportImport'
import { encryptBackup } from '../lib/backupCrypto'
import { todayISO } from '../lib/dates'
import { saveBackupFile } from '../lib/backupFile'

/**
 * Exports a backup file (share sheet on phones, download elsewhere) and records
 * it as the last backup — protected with a password (encrypted) when one is
 * given. Shared by Settings and the weekly reminder.
 */
export function useBackupExport() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pendingShare, setPendingShare] = useState<File | null>(null)

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

  const exportNow = async (password = '') => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const json = JSON.stringify(await exportAll())
      const contents = password ? JSON.stringify(await encryptBackup(json, password)) : json
      const name = `75hard-backup-${todayISO()}${password ? '-protected' : ''}.json`
      const file = new File([contents], name, { type: 'application/json' })
      await finishSave(file, false)
    } catch {
      setError('Export failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  /** Second tap after the share sheet refused the first one (it needs a fresh gesture). */
  const shareNow = async (file: File) => {
    try {
      await finishSave(file, true)
    } catch {
      setError('Export failed. Please try again.')
    }
  }

  return { busy, error, notice, pendingShare, exportNow, shareNow, clearMessages: () => { setError(null); setNotice(null) } }
}

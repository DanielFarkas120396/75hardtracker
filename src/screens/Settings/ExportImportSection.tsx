import { useRef, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { exportAll, importAll, isValidExportPayload, type ExportPayload } from '../../db/exportImport'
import { todayISO } from '../../lib/dates'

export function ExportImportSection() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingImport, setPendingImport] = useState<ExportPayload | null>(null)

  const handleExport = async () => {
    setBusy(true)
    setError(null)
    try {
      const payload = await exportAll()
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `75hard-export-${todayISO()}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('Export failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const handleFileSelected = async (file: File) => {
    setError(null)
    try {
      const text = await file.text()
      const parsed: unknown = JSON.parse(text)
      if (!isValidExportPayload(parsed)) {
        setError('That file doesn’t look like a valid 75 Hard export.')
        return
      }
      setPendingImport(parsed)
    } catch {
      setError('Could not read that file. Make sure it’s an export from this app.')
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

  return (
    <section className="rounded-card bg-surface p-4 shadow-sm">
      <h2 className="font-rounded text-lg font-extrabold text-ink">Export / Import</h2>
      <p className="mt-1 text-sm text-ink-muted">Back up everything — including photos — as one JSON file.</p>

      <div className="mt-3 flex flex-col gap-2">
        <Button variant="secondary" onClick={() => void handleExport()} disabled={busy}>
          Export data
        </Button>
        <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={busy}>
          Import data
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleFileSelected(file)
            e.target.value = ''
          }}
        />
      </div>

      {error && <p className="mt-2 text-sm font-semibold text-danger-dark">{error}</p>}

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

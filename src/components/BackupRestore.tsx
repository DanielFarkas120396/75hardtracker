import { useRef, useState } from 'react'
import { openProtectedBackup, readBackupText } from '../db/backupReading'
import { importAll, type ExportPayload } from '../db/exportImport'
import type { EncryptedBackup } from '../lib/backupCrypto'
import { Button } from './ui/Button'
import { Field } from './ui/Field'
import { Modal } from './ui/Modal'

interface BackupRestoreProps {
  label: string
  /** A full button (Settings) or a quiet link (the welcome screen). */
  look?: 'button' | 'link'
  /** Ask before replacing what's on this device (Settings); a fresh install has nothing to lose. */
  confirmReplace?: boolean
}

/**
 * Restoring a backup file: picks it, asks for its password if it's
 * protected, confirms the replacement where there's data to lose, imports it
 * and reloads the app.
 */
export function BackupRestore({ label, look = 'button', confirmReplace = true }: BackupRestoreProps) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [locked, setLocked] = useState<EncryptedBackup | null>(null)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [pending, setPending] = useState<ExportPayload | null>(null)

  const restore = async (payload: ExportPayload) => {
    setBusy(true)
    try {
      await importAll(payload)
      window.location.reload()
    } catch {
      setError('Restoring failed. Your existing data was not changed.')
      setBusy(false)
      setPending(null)
    }
  }

  const accept = (payload: ExportPayload) => {
    if (confirmReplace) setPending(payload)
    else void restore(payload)
  }

  const onFile = async (file: File) => {
    setError(null)
    const contents = readBackupText(await file.text())
    if (contents.kind === 'invalid') setError(contents.error)
    else if (contents.kind === 'protected') setLocked(contents.file)
    else accept(contents.payload)
  }

  const unlock = async () => {
    if (!locked) return
    setBusy(true)
    const result = await openProtectedBackup(locked, password)
    setBusy(false)
    if (!result.ok) return setPasswordError(result.error)
    setLocked(null)
    setPassword('')
    setPasswordError(null)
    accept(result.payload)
  }

  return (
    <>
      {look === 'button' ? (
        <Button variant="secondary" onClick={() => fileInput.current?.click()} disabled={busy}>
          {label}
        </Button>
      ) : (
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="min-h-touch font-rounded text-sm font-bold text-ink-muted underline"
        >
          {label}
        </button>
      )}
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        aria-label="Backup file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void onFile(file)
          e.target.value = ''
        }}
      />
      {error && (
        <p role="alert" className="mt-2 text-sm font-semibold text-danger-ink">
          {error}
        </p>
      )}

      <Modal open={locked !== null} onClose={() => setLocked(null)}>
        <h3 className="font-rounded text-lg font-extrabold text-ink">This backup is protected</h3>
        <Field label="Its password" error={passwordError ?? undefined}>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="min-h-touch w-full rounded-xl bg-canvas px-3 font-rounded text-ink"
          />
        </Field>
        <div className="mt-4 flex gap-2">
          <Button className="flex-1" onClick={() => void unlock()} disabled={busy || password === ''}>
            {busy ? 'Opening…' : 'Open'}
          </Button>
          <Button variant="secondary" className="flex-1" onClick={() => setLocked(null)} disabled={busy}>
            Cancel
          </Button>
        </div>
      </Modal>

      <Modal open={pending !== null} onClose={() => setPending(null)}>
        <h3 className="font-rounded text-lg font-extrabold text-ink">Replace all data?</h3>
        <p className="mt-2 text-sm text-ink-muted">
          Restoring this file will replace everything currently on this device — all attempts, photos, and badges — with
          the contents of the file. This can't be undone.
        </p>
        <div className="mt-4 flex gap-2">
          <Button variant="danger" className="flex-1" onClick={() => pending && void restore(pending)} disabled={busy}>
            {busy ? 'Restoring…' : 'Replace data'}
          </Button>
          <Button variant="secondary" className="flex-1" onClick={() => setPending(null)} disabled={busy}>
            Cancel
          </Button>
        </div>
      </Modal>
    </>
  )
}

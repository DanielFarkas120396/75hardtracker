import { useState } from 'react'
import { useBackupExport } from '../hooks/useBackupExport'
import { Button } from './ui/Button'
import { Field } from './ui/Field'
import { Modal } from './ui/Modal'

const INPUT = 'min-h-touch w-full rounded-xl bg-canvas px-3 font-rounded text-ink'

/**
 * Saving a backup: an optional password (typed twice) that encrypts the file,
 * then the share sheet ("Save to Files", AirDrop…). Used by Settings and the
 * weekly reminder.
 */
export function BackupExportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { busy, error, notice, pendingShare, exportNow, shareNow, clearMessages } = useBackupExport()
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')

  const mismatch = password !== '' && again !== '' && password !== again
  const tooShort = password !== '' && password.length < 6
  const ready = !busy && !mismatch && !tooShort && (password === '' || password === again)

  const close = () => {
    setPassword('')
    setAgain('')
    clearMessages()
    onClose()
  }

  return (
    <Modal open={open} onClose={close}>
      <h3 className="font-rounded text-lg font-bold text-ink">Save a backup</h3>
      <p className="mt-1 text-sm text-ink-muted">
        One file with everything, photos included. Save it to <strong className="text-ink">iCloud Drive</strong> (Save to
        Files), so it survives losing your phone.
      </p>

      {notice ? (
        <>
          <p role="status" className="mt-4 rounded-2xl bg-world-soft p-3 font-rounded font-bold text-world-ink">
            {notice} ✓
          </p>
          <Button className="mt-4 w-full" onClick={close}>
            Done
          </Button>
        </>
      ) : (
        <>
          <Field label="Password (optional)" error={tooShort ? 'At least 6 characters.' : undefined}>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={INPUT}
            />
          </Field>
          {password !== '' && (
            <Field label="Type it again" error={mismatch ? "The two passwords don't match." : undefined}>
              <input
                type="password"
                autoComplete="new-password"
                value={again}
                onChange={(e) => setAgain(e.target.value)}
                className={INPUT}
              />
            </Field>
          )}
          <p className="mt-2 text-xs text-ink-muted">
            {password === ''
              ? 'Without a password, anyone who gets the file can open it.'
              : 'The file will be encrypted. A forgotten password can’t be recovered, and nor can the backup.'}
          </p>

          <div className="mt-4 flex flex-col gap-2">
            {pendingShare ? (
              <Button onClick={() => void shareNow(pendingShare)}>Share backup file</Button>
            ) : (
              <Button onClick={() => void exportNow(password)} disabled={!ready}>
                {busy ? 'Preparing backup…' : password ? 'Save protected backup' : 'Save backup'}
              </Button>
            )}
            <Button variant="secondary" onClick={close} disabled={busy}>
              Cancel
            </Button>
          </div>
          {error && (
            <p role="alert" className="mt-2 text-sm font-semibold text-danger-ink">
              {error}
            </p>
          )}
        </>
      )}
    </Modal>
  )
}

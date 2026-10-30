import { useRef, useState } from 'react'
import { openProtectedBackup, readBackupText } from '../db/backupReading'
import { stakesLine } from '../content/variants'
import { findBackupGap, importAll, withGapRestored, type BackupGap, type ExportPayload } from '../db/exportImport'
import type { EncryptedBackup } from '../lib/backupCrypto'
import { CHALLENGE_LENGTH } from '../logic/constants'
import { rulesFor } from '../logic/rulesets'
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
 * protected, confirms the replacement where there's data to lose, asks about
 * any days the backup can't know about, imports it and reloads the app.
 */
export function BackupRestore({ label, look = 'button', confirmReplace = true }: BackupRestoreProps) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [locked, setLocked] = useState<EncryptedBackup | null>(null)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [pending, setPending] = useState<ExportPayload | null>(null)
  const [gapped, setGapped] = useState<{ payload: ExportPayload; gap: BackupGap } | null>(null)

  const restore = async (payload: ExportPayload) => {
    setBusy(true)
    try {
      await importAll(payload)
      window.location.reload()
    } catch {
      setError('Restoring failed. Your existing data was not changed.')
      setBusy(false)
      setPending(null)
      setGapped(null)
    }
  }

  const restoreOrAsk = (payload: ExportPayload) => {
    const gap = findBackupGap(payload)
    setPending(null)
    if (gap) setGapped({ payload, gap })
    else void restore(payload)
  }

  const accept = (payload: ExportPayload) => {
    if (confirmReplace) setPending(payload)
    else restoreOrAsk(payload)
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
        <h3 className="font-rounded text-lg font-bold text-ink">This backup is protected</h3>
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
        <h3 className="font-rounded text-lg font-bold text-ink">Replace all data?</h3>
        <p className="mt-2 text-sm text-ink-muted">
          Restoring this file will replace everything currently on this device — all attempts, photos, and badges — with
          the contents of the file. This can't be undone.
        </p>
        <div className="mt-4 flex gap-2">
          <Button variant="danger" className="flex-1" onClick={() => pending && restoreOrAsk(pending)} disabled={busy}>
            {busy ? 'Restoring…' : 'Replace data'}
          </Button>
          <Button variant="secondary" className="flex-1" onClick={() => setPending(null)} disabled={busy}>
            Cancel
          </Button>
        </div>
      </Modal>

      <Modal open={gapped !== null} onClose={() => setGapped(null)}>
        {gapped && (
          <BackupGapQuestion
            gap={gapped.gap}
            busy={busy}
            onDidThem={() => void restore(withGapRestored(gapped.payload, gapped.gap))}
            onMissedThem={() => void restore(gapped.payload)}
          />
        )}
      </Modal>
    </>
  )
}

function BackupGapQuestion({ gap, busy, onDidThem, onMissedThem }: {
  gap: BackupGap
  busy: boolean
  onDidThem: () => void
  onMissedThem: () => void
}) {
  const first = gap.days[0]
  const last = gap.days[gap.days.length - 1]
  const one = gap.days.length === 1
  return (
    <>
      <h3 className="font-rounded text-lg font-bold text-ink">
        {gap.backupDay < 1 ? 'This backup is from before Day 1' : `This backup stops at Day ${gap.backupDay}`}
      </h3>
      <p className="mt-2 text-sm text-ink-muted">
        {gap.todayDayNumber <= CHALLENGE_LENGTH && `Today is Day ${gap.todayDayNumber}. `}
        {one ? `Day ${first} isn't in it. Did you do it?` : `Days ${first} to ${last} aren't in it. Did you do them?`}
      </p>
      <p className="mt-2 text-sm text-ink-muted">Their tasks, photos and notes aren't in the backup either way.</p>
      <div className="mt-4 flex flex-col gap-2">
        <Button className="w-full" onClick={onDidThem} disabled={busy}>
          {one ? 'Yes, I did it' : 'Yes, I did them'}
        </Button>
        <Button variant="secondary" className="w-full" onClick={onMissedThem} disabled={busy}>
          {one ? 'No, count it as missed' : 'No, count them as missed'}
        </Button>
      </div>
      <p className="mt-2 text-sm font-semibold text-ink-muted">{stakesLine(rulesFor(gap.challenge))}</p>
    </>
  )
}

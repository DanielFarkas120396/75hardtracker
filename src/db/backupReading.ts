import { decryptBackup, isEncryptedBackup, type EncryptedBackup } from '../lib/backupCrypto'
import { validateExportPayload, type ExportPayload } from './exportImport'

const UNREADABLE = 'Could not read that file. Make sure it’s a backup exported from this app.'

export type BackupFileContents =
  | { kind: 'plain'; payload: ExportPayload }
  | { kind: 'protected'; file: EncryptedBackup }
  | { kind: 'invalid'; error: string }

/** Reads a chosen backup file's text: a plain backup (validated), a password-protected one, or neither. */
export function readBackupText(text: string): BackupFileContents {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { kind: 'invalid', error: UNREADABLE }
  }
  if (isEncryptedBackup(parsed)) return { kind: 'protected', file: parsed }
  const result = validateExportPayload(parsed)
  return result.ok ? { kind: 'plain', payload: result.payload } : { kind: 'invalid', error: result.error }
}

/** Opens a password-protected backup: its validated contents, or why not. */
export async function openProtectedBackup(
  file: EncryptedBackup,
  password: string,
): Promise<{ ok: true; payload: ExportPayload } | { ok: false; error: string }> {
  const json = await decryptBackup(file, password)
  if (json === null) return { ok: false, error: 'Wrong password, or the file was changed.' }
  const contents = readBackupText(json)
  return contents.kind === 'plain' ? { ok: true, payload: contents.payload } : { ok: false, error: UNREADABLE }
}

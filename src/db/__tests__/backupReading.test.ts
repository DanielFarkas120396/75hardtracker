// @vitest-environment node
// (Node's Blob survives IndexedDB's structured clone; jsdom's doesn't.)
import { beforeEach, describe, expect, it } from 'vitest'
import { todayISO } from '../../lib/dates'
import { encryptBackup } from '../../lib/backupCrypto'
import { openProtectedBackup, readBackupText } from '../backupReading'
import { exportAll } from '../exportImport'
import { addChallenge, freshDatabase } from './fixtures'

beforeEach(freshDatabase)

async function backupJson() {
  await addChallenge({ startDate: todayISO(), attemptNumber: 1, status: 'active' })
  return JSON.stringify(await exportAll())
}

describe('reading a backup file', () => {
  it('reads a plain backup', async () => {
    expect(readBackupText(await backupJson())).toMatchObject({ kind: 'plain' })
  })

  it('recognises a protected backup, and opens it with its password only', async () => {
    const protectedFile = JSON.stringify(await encryptBackup(await backupJson(), 'duck-with-a-knife', 1_000))
    const contents = readBackupText(protectedFile)
    expect(contents.kind).toBe('protected')
    if (contents.kind !== 'protected') return

    expect(await openProtectedBackup(contents.file, 'nope')).toEqual({ ok: false, error: 'Wrong password, or the file was changed.' })
    const opened = await openProtectedBackup(contents.file, 'duck-with-a-knife')
    expect(opened.ok).toBe(true)
  })

  it('refuses files that are not backups', () => {
    expect(readBackupText('not json')).toMatchObject({ kind: 'invalid' })
    expect(readBackupText('{"hello": 1}')).toMatchObject({ kind: 'invalid' })
  })
})

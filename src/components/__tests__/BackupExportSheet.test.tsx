import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { addChallenge, freshDatabase } from '../../db/__tests__/fixtures'
import { db } from '../../db/db'
import { SETTING_KEYS } from '../../db/repositories/settingsRepo'
import { decryptBackup, isEncryptedBackup } from '../../lib/backupCrypto'
import { saveBackupFile } from '../../lib/backupFile'
import { todayISO } from '../../lib/dates'
import { BackupExportSheet } from '../BackupExportSheet'

// The real encryption, with few rounds so the tests stay fast.
vi.mock('../../lib/backupCrypto', async (original) => {
  const actual = await original<typeof import('../../lib/backupCrypto')>()
  return { ...actual, encryptBackup: (json: string, password: string) => actual.encryptBackup(json, password, 1_000) }
})

vi.mock('../../lib/backupFile', () => ({ saveBackupFile: vi.fn() }))
const save = vi.mocked(saveBackupFile)

/** The file handed to the share sheet (or the download) on the given call. */
function savedFile(call = 0): File {
  return save.mock.calls[call][0]
}

function passwordField() {
  return screen.getByLabelText('Password (optional)')
}

describe('BackupExportSheet', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  beforeEach(async () => {
    await freshDatabase()
    await addChallenge({ startDate: todayISO(), attemptNumber: 1, status: 'active' })
    save.mockReset()
    save.mockResolvedValue('downloaded')
  })

  it('saves a plain backup without a password, and records it as the last backup', async () => {
    render(<BackupExportSheet open onClose={() => {}} />)
    expect(screen.getByText('Without a password, anyone who gets the file can open it.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Save backup' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Backup downloaded.')
    const file = savedFile()
    expect(file.name).toBe(`75hard-backup-${todayISO()}.json`)
    const contents = JSON.parse(await file.text())
    expect(isEncryptedBackup(contents)).toBe(false)
    expect(contents.challenges).toHaveLength(1)
    expect(await db.settings.get(SETTING_KEYS.lastExportAt)).toBeDefined()
  })

  it('refuses a password shorter than 6 characters', () => {
    render(<BackupExportSheet open onClose={() => {}} />)
    fireEvent.change(passwordField(), { target: { value: 'duck' } })

    expect(screen.getByText('At least 6 characters.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save protected backup' })).toBeDisabled()
  })

  it('waits for the password to be typed again, and refuses two that differ', () => {
    render(<BackupExportSheet open onClose={() => {}} />)
    fireEvent.change(passwordField(), { target: { value: 'duck-with-a-knife' } })
    const save = screen.getByRole('button', { name: 'Save protected backup' })
    expect(save).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Type it again'), { target: { value: 'duck-with-a-spoon' } })
    expect(screen.getByText("The two passwords don't match.")).toBeInTheDocument()
    expect(save).toBeDisabled()
  })

  it('encrypts the file with a confirmed password, so only that password opens it', async () => {
    render(<BackupExportSheet open onClose={() => {}} />)
    fireEvent.change(passwordField(), { target: { value: 'duck-with-a-knife' } })
    fireEvent.change(screen.getByLabelText('Type it again'), { target: { value: 'duck-with-a-knife' } })
    expect(screen.getByText(/A forgotten password can’t be recovered/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Save protected backup' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Backup downloaded.')
    const file = savedFile()
    expect(file.name).toBe(`75hard-backup-${todayISO()}-protected.json`)
    const contents: unknown = JSON.parse(await file.text())
    if (!isEncryptedBackup(contents)) throw new Error('expected an encrypted backup')
    expect(await decryptBackup(contents, 'duck-with-a-spoon')).toBeNull()
    const json = await decryptBackup(contents, 'duck-with-a-knife')
    expect(JSON.parse(json!).challenges).toHaveLength(1)
  })

  it('offers a second tap when the share sheet needs a fresh gesture', async () => {
    save.mockResolvedValueOnce('needsGesture').mockResolvedValueOnce('shared')
    render(<BackupExportSheet open onClose={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Save backup' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Share backup file' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Backup shared.')
    expect(save).toHaveBeenCalledTimes(2)
    expect(savedFile(1)).toBe(savedFile(0))
    expect(save.mock.calls[1][1]).toEqual({ fromFreshTap: true })
  })

  it('records nothing when the share sheet is cancelled', async () => {
    save.mockResolvedValueOnce('cancelled')
    render(<BackupExportSheet open onClose={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Save backup' }))

    await waitFor(() => expect(save).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save backup' })).toBeEnabled())
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(await db.settings.get(SETTING_KEYS.lastExportAt)).toBeUndefined()
  })

  it('says so when saving fails', async () => {
    save.mockRejectedValueOnce(new Error('disk full'))
    render(<BackupExportSheet open onClose={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Save backup' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Export failed. Please try again.')
  })

  it('forgets the password when cancelled', () => {
    const onClose = vi.fn()
    const { rerender } = render(<BackupExportSheet open onClose={onClose} />)
    fireEvent.change(passwordField(), { target: { value: 'duck-with-a-knife' } })

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalled()

    rerender(<BackupExportSheet open onClose={onClose} />)
    expect(passwordField()).toHaveValue('')
    expect(screen.queryByLabelText('Type it again')).not.toBeInTheDocument()
  })
})

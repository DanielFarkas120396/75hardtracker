import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { addChallenge, freshDatabase } from '../../db/__tests__/fixtures'
import { db } from '../../db/db'
import { exportAll, importAll } from '../../db/exportImport'
import { encryptBackup } from '../../lib/backupCrypto'
import { todayISO } from '../../lib/dates'
import { BackupRestore } from '../BackupRestore'

// The real import, watched; it reloads the app afterwards, which jsdom can't do.
vi.mock('../../db/exportImport', async (original) => {
  const actual = await original<typeof import('../../db/exportImport')>()
  return { ...actual, importAll: vi.fn(actual.importAll) }
})
const restored = vi.mocked(importAll)

/** A backup with one attempt (attempt #7, to tell it apart), as the file's text. */
async function backupText(): Promise<string> {
  await addChallenge({ startDate: todayISO(), attemptNumber: 7, status: 'active' })
  const json = JSON.stringify(await exportAll())
  await freshDatabase()
  return json
}

function pickFile(text: string) {
  const file = new File([text], 'backup.json', { type: 'application/json' })
  fireEvent.change(screen.getByLabelText('Backup file'), { target: { files: [file] } })
}

async function attemptNumbers(): Promise<number[]> {
  return (await db.challenges.toArray()).map((c) => c.attemptNumber)
}

describe('BackupRestore', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  beforeEach(async () => {
    await freshDatabase()
    restored.mockClear()
    // jsdom has no navigation: the reload after a restore does nothing here.
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('asks before replacing the data on this device, and leaves it alone on Cancel', async () => {
    const text = await backupText()
    await addChallenge({ startDate: todayISO(), attemptNumber: 1, status: 'active' })
    render(<BackupRestore label="Restore a backup" />)

    pickFile(text)
    expect(await screen.findByRole('heading', { name: 'Replace all data?' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Replace all data?' })).not.toBeInTheDocument())
    expect(restored).not.toHaveBeenCalled()
    expect(await attemptNumbers()).toEqual([1])
  })

  it('replaces the data once confirmed', async () => {
    const text = await backupText()
    await addChallenge({ startDate: todayISO(), attemptNumber: 1, status: 'active' })
    render(<BackupRestore label="Restore a backup" />)

    pickFile(text)
    fireEvent.click(await screen.findByRole('button', { name: 'Replace data' }))

    await waitFor(() => expect(restored).toHaveBeenCalledTimes(1))
    await waitFor(async () => expect(await attemptNumbers()).toEqual([7]))
  })

  it('restores straight away from the welcome screen, where there is nothing to lose', async () => {
    const text = await backupText()
    render(<BackupRestore label="Already have a backup? Restore it" look="link" confirmReplace={false} />)

    pickFile(text)

    await waitFor(async () => expect(await attemptNumbers()).toEqual([7]))
    expect(screen.queryByRole('heading', { name: 'Replace all data?' })).not.toBeInTheDocument()
  })

  it('asks for the password of a protected backup, and refuses a wrong one', async () => {
    const text = JSON.stringify(await encryptBackup(await backupText(), 'duck-with-a-knife', 1_000))
    render(<BackupRestore label="Already have a backup? Restore it" look="link" confirmReplace={false} />)

    pickFile(text)
    expect(await screen.findByRole('heading', { name: 'This backup is protected' })).toBeInTheDocument()
    const open = screen.getByRole('button', { name: 'Open' })
    expect(open).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/^Its password/), { target: { value: 'duck-with-a-spoon' } })
    fireEvent.click(open)
    expect(await screen.findByText('Wrong password, or the file was changed.')).toBeInTheDocument()
    expect(restored).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText(/^Its password/), { target: { value: 'duck-with-a-knife' } })
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))

    await waitFor(async () => expect(await attemptNumbers()).toEqual([7]))
  })

  it('refuses a file that is not a backup, without touching the data', async () => {
    await addChallenge({ startDate: todayISO(), attemptNumber: 1, status: 'active' })
    render(<BackupRestore label="Restore a backup" />)

    pickFile('{"hello": 1}')

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(restored).not.toHaveBeenCalled()
    expect(await attemptNumbers()).toEqual([1])
  })

  it('says so when restoring fails, and keeps the existing data', async () => {
    const text = await backupText()
    await addChallenge({ startDate: todayISO(), attemptNumber: 1, status: 'active' })
    restored.mockRejectedValueOnce(new Error('quota'))
    render(<BackupRestore label="Restore a backup" />)

    pickFile(text)
    fireEvent.click(await screen.findByRole('button', { name: 'Replace data' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Restoring failed. Your existing data was not changed.')
    expect(await attemptNumbers()).toEqual([1])
  })
})

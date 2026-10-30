import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { addChallenge, freshDatabase } from '../../db/__tests__/fixtures'
import { db } from '../../db/db'
import { exportAll, importAll } from '../../db/exportImport'
import { encryptBackup } from '../../lib/backupCrypto'
import { addDaysISO, todayISO } from '../../lib/dates'
import { resolveGate } from '../../hooks/useChallengeGate'
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

  describe('a backup older than today', () => {
    /** A Hard attempt on Day 8 today, with a backup made on Day 3 (Days 1 to 3 complete). */
    async function oldBackup(): Promise<string> {
      const startDate = addDaysISO(todayISO(), -7)
      const challengeId = await addChallenge({ startDate, attemptNumber: 7, status: 'active' })
      for (let dayNumber = 1; dayNumber <= 3; dayNumber++) {
        await db.dayEntries.add({ challengeId, dayNumber, date: addDaysISO(startDate, dayNumber - 1), water_ml: 0, pages_read: 0, dietFollowed: false, noAlcohol: false, completed: true } as never)
      }
      const payload = await exportAll()
      await freshDatabase()
      return JSON.stringify({ ...payload, exportedAt: `${addDaysISO(startDate, 2)}T12:00:00` })
    }

    const gateOfRestored = async () => {
      const [challenge] = await db.challenges.toArray()
      return resolveGate(challenge, await db.dayEntries.toArray(), todayISO())
    }

    const welcome = () => render(<BackupRestore label="Restore" look="link" confirmReplace={false} />)

    it('asks about the missing days before it restores anything', async () => {
      const text = await oldBackup()
      welcome()
      pickFile(text)

      expect(await screen.findByRole('heading', { name: 'This backup stops at Day 3' })).toBeInTheDocument()
      expect(screen.getByText(/Today is Day 8\. Days 4 to 7 aren't in it\. Did you do them\?/)).toBeInTheDocument()
      expect(screen.getByText('Miss a day: back to Day 1.')).toBeInTheDocument()
      expect(restored).not.toHaveBeenCalled()
    })

    it('"Yes" keeps the attempt on Day 8 with the streak whole', async () => {
      const text = await oldBackup()
      welcome()
      pickFile(text)
      fireEvent.click(await screen.findByRole('button', { name: 'Yes, I did them' }))

      await waitFor(async () => expect(await attemptNumbers()).toEqual([7]))
      const gate = await gateOfRestored()
      expect(gate.kind).toBe('active')
      expect(gate.streak).toBe(7)
    })

    it('"No" restores the backup under the normal rules', async () => {
      const text = await oldBackup()
      welcome()
      pickFile(text)
      fireEvent.click(await screen.findByRole('button', { name: 'No, count them as missed' }))

      await waitFor(async () => expect(await attemptNumbers()).toEqual([7]))
      expect((await gateOfRestored()).kind).toBe('needsRestart')
    })

    it('comes after "Replace all data?" in Settings', async () => {
      const text = await oldBackup()
      render(<BackupRestore label="Restore a backup" />)
      pickFile(text)
      fireEvent.click(await screen.findByRole('button', { name: 'Replace data' }))

      expect(await screen.findByRole('button', { name: 'Yes, I did them' })).toBeInTheDocument()
      expect(restored).not.toHaveBeenCalled()
    })

    it('keeps the restored days through the next backup', async () => {
      const text = await oldBackup()
      welcome()
      pickFile(text)
      fireEvent.click(await screen.findByRole('button', { name: 'Yes, I did them' }))
      await waitFor(async () => expect(await attemptNumbers()).toEqual([7]))

      expect((await exportAll()).challenges[0].restoredDays).toEqual([4, 5, 6, 7])
    })
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

import { encryptBackup } from '@logic/backupCrypto'
import { findBackupGap } from '@logic/backupFormat'
import { todayISO } from '@logic/dates'
import { fireEvent, render, screen } from '@testing-library/react-native'
import * as Font from 'expo-font'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ReactNode } from 'react'
import { addChallenge, freshDatabase } from '../../db/__tests__/fixtures'
import { challengeRepo } from '../../db/repositories/challengeRepo'
import { nodeStore } from '../../files/__tests__/nodeStore'
import type { FileStore } from '../../files/store'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { ImportBackup } from '../ImportBackupFlow'
import { sampleBackup } from './sampleBackup'

jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }))
jest.mock('expo-crypto', () => jest.requireActual('./nodeAes'))

const Providers = ({ children }: { children: ReactNode }) => <ThemeProvider>{children}</ThemeProvider>
let store: FileStore

beforeEach(async () => {
  jest.mocked(Font.useFonts).mockReturnValue([true, null])
  await freshDatabase()
  store = nodeStore(mkdtempSync(join(tmpdir(), 'import-ui-')))
})

/** A backup whose attempt is over, so there are no missing days to ask about. */
function finishedBackup() {
  const backup = sampleBackup()
  backup.challenges[1].status = 'failed'
  return backup
}

async function open(pick: () => Promise<string | null>, files: FileStore = store) {
  await render(<ImportBackup pick={pick} store={files} />, { wrapper: Providers })
  await fireEvent.press(await screen.findByText('Import a web app backup'))
}
const attempts = async () => (await challengeRepo.getAll()).map((challenge) => challenge.attemptNumber)

it('imports a plain backup straight away on an empty phone', async () => {
  await open(async () => JSON.stringify(finishedBackup()))
  expect(await screen.findByText('Backup imported.')).toBeOnTheScreen()
  expect(await attempts()).toEqual([1, 2])
})

it('does nothing when the file picker is cancelled, and can start again', async () => {
  let picks = 0
  await open(async () => (++picks === 1 ? null : JSON.stringify(finishedBackup())))
  expect(screen.queryByRole('alert')).toBeNull()
  expect(await attempts()).toEqual([])
  await fireEvent.press(screen.getByText('Import a web app backup'))
  expect(await screen.findByText('Backup imported.')).toBeOnTheScreen()
})

it('says so when the file isn’t a backup, and imports nothing', async () => {
  await open(async () => 'not json at all')
  expect(
    await screen.findByText('Could not read that file. Make sure it’s a backup exported from this app.'),
  ).toBeOnTheScreen()
  expect(await attempts()).toEqual([])
})

it('refuses a backup made by a newer version', async () => {
  await open(async () => JSON.stringify({ ...finishedBackup(), version: 99 }))
  expect(
    await screen.findByText('This backup was made by a newer version of the app. Update the app, then try again.'),
  ).toBeOnTheScreen()
  expect(await attempts()).toEqual([])
})

describe('when the phone already has an attempt', () => {
  beforeEach(async () => {
    await addChallenge({ startDate: '2025-12-01', attemptNumber: 7, status: 'failed' })
  })

  it('asks before replacing, and Cancel keeps everything', async () => {
    await open(async () => JSON.stringify(finishedBackup()))
    expect(await screen.findByText('Replace all data?')).toBeOnTheScreen()
    await fireEvent.press(screen.getByText('Cancel'))
    expect(screen.queryByText('Replace all data?')).toBeNull()
    expect(await attempts()).toEqual([7])
  })

  it('replaces after "Replace data"', async () => {
    await open(async () => JSON.stringify(finishedBackup()))
    await fireEvent.press(await screen.findByText('Replace data'))
    expect(await screen.findByText('Backup imported.')).toBeOnTheScreen()
    expect(await attempts()).toEqual([1, 2])
  })
})

describe('a backup that stops before today (its attempt is still running)', () => {
  it('asks about the missing days, and "Yes" counts them as done', async () => {
    await open(async () => JSON.stringify(sampleBackup()))
    expect(await screen.findByText('This backup stops at Day 3')).toBeOnTheScreen()
    await fireEvent.press(screen.getByText('Yes, I did them'))
    expect(await screen.findByText('Backup imported.')).toBeOnTheScreen()
    const running = (await challengeRepo.getAll())[1]
    // Which days count as missing is the shared rule's call (findBackupGap): the flow passes them on.
    expect(running.restoredDays).toEqual(findBackupGap(sampleBackup(), todayISO())!.days)
    expect(running.restoredDays!.length).toBeGreaterThan(0)
  })

  it('"No" imports the backup as it is', async () => {
    await open(async () => JSON.stringify(sampleBackup()))
    await fireEvent.press(await screen.findByText('No, count them as missed'))
    expect(await screen.findByText('Backup imported.')).toBeOnTheScreen()
    expect((await challengeRepo.getAll())[1].restoredDays).toBeUndefined()
  })

  it('closing the question imports nothing', async () => {
    await open(async () => JSON.stringify(sampleBackup()))
    await fireEvent.press(await screen.findByText('Not now'))
    expect(screen.queryByText('This backup stops at Day 3')).toBeNull()
    expect(await attempts()).toEqual([])
  })
})

describe('a password-protected backup', () => {
  const protectedText = async () => JSON.stringify(await encryptBackup(JSON.stringify(finishedBackup()), 'correct horse', 1000))

  it('asks for the password and refuses a wrong one', async () => {
    await open(protectedText)
    expect(await screen.findByText('This backup is protected')).toBeOnTheScreen()
    await fireEvent.changeText(screen.getByLabelText('Its password'), 'wrong horse')
    await fireEvent.press(screen.getByText('Open'))
    expect(await screen.findByText('Wrong password, or the file was changed.')).toBeOnTheScreen()
    expect(await attempts()).toEqual([])
  })

  it('imports with the right password', async () => {
    await open(protectedText)
    await fireEvent.changeText(await screen.findByLabelText('Its password'), 'correct horse')
    await fireEvent.press(screen.getByText('Open'))
    expect(await screen.findByText('Backup imported.')).toBeOnTheScreen()
    expect(await attempts()).toEqual([1, 2])
  })

  it('Cancel closes it and imports nothing', async () => {
    await open(protectedText)
    await fireEvent.press(await screen.findByText('Cancel'))
    expect(screen.queryByText('This backup is protected')).toBeNull()
    expect(await attempts()).toEqual([])
  })
})

it('says so when the import fails, and keeps what was there', async () => {
  await addChallenge({ startDate: '2025-12-01', attemptNumber: 7, status: 'failed' })
  const broken: FileStore = { ...store, writeBase64: async () => Promise.reject(new Error('disk full')) }
  await open(async () => JSON.stringify(finishedBackup()), broken)
  await fireEvent.press(await screen.findByText('Replace data'))
  expect(await screen.findByText('Restoring failed. Your existing data was not changed.')).toBeOnTheScreen()
  expect(await attempts()).toEqual([7])
})

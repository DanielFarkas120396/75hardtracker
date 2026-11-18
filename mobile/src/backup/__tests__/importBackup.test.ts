/** @jest-environment node */
import { SETTING_KEYS } from '@logic/settingKeys'
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { addChallenge, freshDatabase } from '../../db/__tests__/fixtures'
import { getDb } from '../../db/open'
import { challengeRepo } from '../../db/repositories/challengeRepo'
import { settingsRepo } from '../../db/repositories/settingsRepo'
import { ROWS, type Row } from '../../db/rows'
import { nodeStore } from '../../files/__tests__/nodeStore'
import { commitStaged, stagePictures } from '../../files/pictures'
import type { FileStore } from '../../files/store'
import { importBackup, PictureSwapError, recoverPictures } from '../importBackup'
import { base64, sampleBackup, SAMPLE_TODAY } from './sampleBackup'

let root: string
let store: FileStore

beforeEach(async () => {
  await freshDatabase()
  root = mkdtempSync(join(tmpdir(), 'import-'))
  store = nodeStore(root)
})

async function all<T>(table: keyof typeof ROWS): Promise<T[]> {
  const rows = await getDb().getAllAsync<Row>(`SELECT * FROM ${table} ORDER BY id`)
  return rows.map((row) => ROWS[table].fromRow(row) as T)
}

/** What the phone held before an import that must not go through. */
async function somethingAlreadyThere() {
  await addChallenge({ startDate: '2025-12-01', attemptNumber: 7, status: 'active' })
  await stagePictures(store, [{ folder: 'photos', id: 99, base64: base64('kept'), mimeType: 'image/jpeg' }])
  commitStaged(store)
}

async function expectUntouched() {
  expect((await challengeRepo.getAll()).map((challenge) => challenge.attemptNumber)).toEqual([7])
  expect(readdirSync(join(root, 'pictures/photos'))).toEqual(['99.jpg'])
  expect(store.exists('pictures-incoming')).toBe(false)
}

it('brings in every table as the backup holds it', async () => {
  const backup = sampleBackup()
  await importBackup(backup, store, SAMPLE_TODAY)

  expect(await all('challenges')).toStrictEqual(backup.challenges)
  expect(await all('dayEntries')).toStrictEqual(backup.dayEntries)
  expect(await all('workouts')).toStrictEqual(backup.workouts)
  expect(await all('measurements')).toStrictEqual(backup.measurements)
  expect(await all('badges')).toStrictEqual(backup.badges)
  expect(await all('books')).toStrictEqual([
    { id: 1, title: 'Dune', totalPages: 600, currentPage: 4, finished: false, coverFile: '1.png' },
    { id: 2, title: 'Emma', totalPages: 400, currentPage: 400, finished: true, finishedAt: '2026-02-01T20:00:00.000Z' },
  ])
  expect(await all('photos')).toStrictEqual([
    { id: 10, date: '2026-03-01', file: '10.jpg', mimeType: 'image/jpeg' },
    { id: 11, date: '2026-03-02', file: '11.jpg', mimeType: 'image/jpeg' },
    { id: 12, date: '2026-03-03', file: '12.webp', mimeType: 'image/webp' },
  ])
})

it('turns photos and covers into files', async () => {
  await importBackup(sampleBackup(), store, SAMPLE_TODAY)
  expect(readdirSync(join(root, 'pictures/photos')).sort()).toEqual(['10.jpg', '11.jpg', '12.webp'])
  expect(readFileSync(join(root, 'pictures/photos/11.jpg'), 'utf8')).toBe('photo eleven')
  expect(readFileSync(join(root, 'pictures/covers/1.png'), 'utf8')).toBe('cover of Dune')
})

it('brings the settings, and counts the data as backed up when the file was made', async () => {
  const backup = sampleBackup()
  await importBackup(backup, store, SAMPLE_TODAY)
  expect(await settingsRepo.get(SETTING_KEYS.bedtime, '')).toBe('22:30')
  expect(await settingsRepo.get(SETTING_KEYS.currentBookId, 0)).toBe(1)
  expect(await settingsRepo.get(SETTING_KEYS.profile, null)).toEqual(backup.settings[1].value)
  expect(await settingsRepo.get(SETTING_KEYS.lastExportAt, '')).toBe(backup.exportedAt)
})

it('keeps this phone’s own lock, whatever the backup holds', async () => {
  await settingsRepo.set(SETTING_KEYS.appLock, { pin: 'this phone' })
  const backup = sampleBackup()
  backup.settings.push({ key: SETTING_KEYS.appLock, value: { pin: 'another device' } })
  await importBackup(backup, store, SAMPLE_TODAY)
  expect(await settingsRepo.get(SETTING_KEYS.appLock, null)).toEqual({ pin: 'this phone' })
})

it('replaces what was on the phone, rows and pictures', async () => {
  await somethingAlreadyThere()
  await settingsRepo.set(SETTING_KEYS.soundEnabled, false)
  await importBackup(sampleBackup(), store, SAMPLE_TODAY)
  expect((await challengeRepo.getAll()).map((challenge) => challenge.attemptNumber)).toEqual([1, 2])
  expect(await settingsRepo.get(SETTING_KEYS.soundEnabled, 'unset')).toBe('unset')
  expect(readdirSync(join(root, 'pictures/photos'))).not.toContain('99.jpg')
  expect(readdirSync(root)).toEqual(['pictures'])
})

it('repairs an old backup on the way in: one entry per day, one running attempt', async () => {
  const backup = sampleBackup()
  backup.dayEntries.push({ ...backup.dayEntries[0], id: 29, water_ml: 2000 })
  backup.challenges.push({ id: 3, startDate: '2026-03-02', attemptNumber: 3, status: 'active' })
  await importBackup(backup, store, SAMPLE_TODAY)

  const challenges = await challengeRepo.getAll()
  expect(challenges.filter((challenge) => challenge.status === 'active')).toHaveLength(1)
  const days = (await getDb().getAllAsync<{ dayNumber: number }>('SELECT dayNumber FROM dayEntries WHERE challengeId = 2')).map(
    (row) => row.dayNumber,
  )
  expect(days.sort()).toEqual([1, 2, 3])
})

it('a null left in an optional field by an old export reads as "not set"', async () => {
  const backup = sampleBackup()
  ;(backup.dayEntries[2] as unknown as Record<string, unknown>).notes = null
  await importBackup(backup, store, SAMPLE_TODAY)
  const day3 = (await all<Record<string, unknown>>('dayEntries'))[2]
  expect('notes' in day3).toBe(false)
})

it('changes nothing when a picture can’t be written', async () => {
  await somethingAlreadyThere()
  let writes = 0
  const failing: FileStore = {
    ...store,
    writeBase64: async (path, data) => {
      if (++writes === 2) throw new Error('disk full')
      await store.writeBase64(path, data)
    },
  }
  await expect(importBackup(sampleBackup(), failing, SAMPLE_TODAY)).rejects.toThrow('disk full')
  await expectUntouched()
})

it('changes nothing when a row can’t be saved', async () => {
  await somethingAlreadyThere()
  const backup = sampleBackup()
  backup.photos.push({ ...backup.photos[0], blobBase64: base64('same id twice') })
  await expect(importBackup(backup, store, SAMPLE_TODAY)).rejects.toThrow(/UNIQUE/)
  await expectUntouched()
})

it('takes in a day an old backup can’t place in the 75 days', async () => {
  const backup = sampleBackup()
  backup.dayEntries.push({ ...backup.dayEntries[0], id: 40, date: '2024-06-01', dayNumber: null as unknown as number })
  await importBackup(backup, store, SAMPLE_TODAY)
  const stray = (await all<Record<string, unknown>>('dayEntries')).find((entry) => entry.id === 40)
  expect(stray).toMatchObject({ id: 40, date: '2024-06-01' })
  expect(stray && 'dayNumber' in stray).toBe(false)
})

describe('when putting the pictures in place fails after the rows are in', () => {
  /** Fails the first rename of the swap, as a full disk or a crash would. */
  function failingOnce(): FileStore {
    let failed = false
    return {
      ...store,
      renameFolder: (from, to) => {
        if (!failed) {
          failed = true
          throw new Error('rename failed')
        }
        store.renameFolder(from, to)
      },
    }
  }

  it('says exactly that, and the next launch finishes the job', async () => {
    await somethingAlreadyThere()
    await expect(importBackup(sampleBackup(), failingOnce(), SAMPLE_TODAY)).rejects.toBeInstanceOf(PictureSwapError)
    // The rows are the backup's: the message must not claim nothing changed.
    expect((await challengeRepo.getAll()).map((challenge) => challenge.attemptNumber)).toEqual([1, 2])

    await recoverPictures(store)
    expect(readdirSync(join(root, 'pictures/photos')).sort()).toEqual(['10.jpg', '11.jpg', '12.webp'])
    expect(readdirSync(root)).toEqual(['pictures'])

    // Nothing is pending any more: a later launch leaves the pictures alone.
    await recoverPictures(store)
    expect(readdirSync(join(root, 'pictures/photos')).sort()).toEqual(['10.jpg', '11.jpg', '12.webp'])
  })
})

it('at launch, clears pictures left by an import that never reached the database', async () => {
  await somethingAlreadyThere()
  await stagePictures(store, [{ folder: 'photos', id: 5, base64: base64('never imported'), mimeType: 'image/jpeg' }])
  await recoverPictures(store)
  await expectUntouched()
})

it('reports the import’s own error even when clearing up fails too', async () => {
  const broken: FileStore = {
    ...store,
    writeBase64: async () => Promise.reject(new Error('disk full')),
    deleteFolder: (path) => {
      if (path === 'pictures-incoming' && store.exists(path)) throw new Error('cannot delete')
      store.deleteFolder(path)
    },
  }
  await expect(importBackup(sampleBackup(), broken, SAMPLE_TODAY)).rejects.toThrow('disk full')
})

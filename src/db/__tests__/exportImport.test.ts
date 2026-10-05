// @vitest-environment node
// (Node's Blob survives IndexedDB's structured clone; jsdom's doesn't.)
import { beforeEach, describe, expect, it } from 'vitest'
import { todayISO } from '../../lib/dates'
import { db } from '../db'
import { EXPORT_VERSION, exportAll, importAll, resetAll, validateExportPayload, type ExportPayload } from '../exportImport'
import { SETTING_KEYS } from '../repositories/settingsRepo'
import type { Badge, Book, DayEntry, Workout } from '../types'
import { addChallenge, addPerfectDay, freshDatabase, jpegBytes } from './fixtures'

beforeEach(freshDatabase)

async function seedEverything() {
  const today = todayISO()
  const challengeId = await addChallenge({ startDate: today, attemptNumber: 1, status: 'active' })
  await addPerfectDay(challengeId, today, 1)
  await db.books.add({
    title: 'Can’t Hurt Me',
    totalPages: 364,
    currentPage: 364,
    finished: true,
    finishedAt: new Date().toISOString(),
  } as Book)
  await db.measurements.add({ date: today, weight_kg: 82.4, bodyMeasurements_cm: { waist: 88 } })
  await db.badges.add({ challengeId, badgeId: 'first-photo', unlockedAt: new Date().toISOString() } as Badge)
  await db.settings.put({ key: SETTING_KEYS.soundEnabled, value: false })
}

async function snapshot() {
  const photos = await db.photos.toArray()
  return {
    challenges: await db.challenges.toArray(),
    dayEntries: await db.dayEntries.toArray(),
    workouts: await db.workouts.toArray(),
    books: await db.books.toArray(),
    measurements: await db.measurements.toArray(),
    badges: await db.badges.toArray(),
    settings: (await db.settings.toArray()).filter((row) => row.key !== SETTING_KEYS.lastExportAt),
    photos: await Promise.all(
      photos.map(async (p) => ({ id: p.id, date: p.date, type: p.blob.type, bytes: [...new Uint8Array(await p.blob.arrayBuffer())] })),
    ),
  }
}

/** Export → JSON text → reset → import, exactly like a real backup and restore. */
async function roundTrip(): Promise<ExportPayload> {
  const json = JSON.stringify(await exportAll())
  await resetAll()
  expect(await db.challenges.count()).toBe(0)
  expect(await db.photos.count()).toBe(0)

  const validation = validateExportPayload(JSON.parse(json))
  if (!validation.ok) throw new Error(validation.error)
  await importAll(validation.payload)
  return validation.payload
}

describe('export → reset → import', () => {
  it('restores every table exactly, including photo bytes', async () => {
    await seedEverything()
    const before = await snapshot()

    await roundTrip()

    const after = await snapshot()
    expect(after).toEqual(before)
    expect(after.photos[0].bytes).toEqual([...jpegBytes(1)])
    expect(after.photos[0].type).toBe('image/jpeg')
  })

  it('records the restored backup as the last backup', async () => {
    await seedEverything()
    const payload = await roundTrip()
    expect(await db.settings.get(SETTING_KEYS.lastExportAt)).toEqual({
      key: SETTING_KEYS.lastExportAt,
      value: payload.exportedAt,
    })
  })

  it('repairs duplicate days from an old backup instead of failing on the unique index', async () => {
    const today = todayISO()
    const challengeId = await addChallenge({ startDate: today, attemptNumber: 1, status: 'active' })
    const payload = await exportAll()
    const duplicate = (id: number, water: number): DayEntry => ({
      id,
      challengeId,
      date: today,
      dayNumber: 1,
      water_ml: water,
      pages_read: 0,
      dietFollowed: false,
      noAlcohol: false,
      completed: false,
    })
    payload.dayEntries = [duplicate(10, 500), duplicate(11, 1500)]
    payload.workouts = [{ id: 1, dayEntryId: 11, type: 'Running', durationMin: 45, isOutdoor: true } as Workout]

    await importAll(JSON.parse(JSON.stringify(payload)))

    const entries = await db.dayEntries.toArray()
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ id: 10, water_ml: 1500 })
    expect(await db.workouts.toArray()).toEqual([expect.objectContaining({ dayEntryId: 10 })])
  })

  it('keeps day plans through a backup', async () => {
    await seedEverything()
    const [entry] = await db.dayEntries.toArray()
    await db.dayEntries.update(entry.id, { plans: { reading: '22:30' } })

    await roundTrip()

    expect((await db.dayEntries.get(entry.id))?.plans).toEqual({ reading: '22:30' })
  })

  it('keeps a plan’s frozen estimate through a backup', async () => {
    await seedEverything()
    const [entry] = await db.dayEntries.toArray()
    await db.dayEntries.update(entry.id, { plans: { reading: '22:30' }, planEstimates: { reading: 20 } })

    await roundTrip()

    expect((await db.dayEntries.get(entry.id))?.planEstimates).toEqual({ reading: 20 })
  })

  it('keeps a challenge’s variant through a backup', async () => {
    await seedEverything()
    const [challenge] = await db.challenges.toArray()
    await db.challenges.update(challenge.id, { variant: 'soft' })

    await roundTrip()

    expect((await db.challenges.get(challenge.id))?.variant).toBe('soft')
  })

  it('keeps a challenge’s social days, its acknowledged jokers, and a day’s rest day through a backup', async () => {
    await seedEverything()
    const [challenge] = await db.challenges.toArray()
    const [entry] = await db.dayEntries.toArray()
    // Soft allows both, so normalizeRecords (run on import) doesn't clean them away.
    await db.challenges.update(challenge.id, { variant: 'soft', socialDays: [4], jokersAcknowledged: 1 })
    await db.dayEntries.update(entry.id, { restDay: true })

    await roundTrip()

    expect((await db.challenges.get(challenge.id))?.socialDays).toEqual([4])
    expect((await db.challenges.get(challenge.id))?.jokersAcknowledged).toBe(1)
    expect((await db.dayEntries.get(entry.id))?.restDay).toBe(true)
  })

  it('keeps a given-up attempt and its give-up date through a backup', async () => {
    await seedEverything()
    const [challenge] = await db.challenges.toArray()
    await db.challenges.update(challenge.id, { status: 'abandoned', abandonedOn: challenge.startDate })

    await roundTrip()

    expect(await db.challenges.get(challenge.id)).toMatchObject({
      status: 'abandoned',
      abandonedOn: challenge.startDate,
    })
  })

  it('keeps how a workout felt through a backup', async () => {
    await seedEverything()
    const [workout] = await db.workouts.toArray()
    await db.workouts.update(workout.id, { feel: 4 })

    await roundTrip()

    expect((await db.workouts.get(workout.id))?.feel).toBe(4)
  })
})

describe('the Face ID lock and backups', () => {
  it("leaves this phone's lock out of a backup, and keeps it through an import", async () => {
    await seedEverything()
    await db.settings.put({ key: SETTING_KEYS.appLock, value: { credentialId: 'this-phone', enabledAt: '2026-10-05T08:00:00Z' } })

    const payload = await exportAll()
    expect(payload.settings.map((row) => row.key)).not.toContain(SETTING_KEYS.appLock)

    // A backup made elsewhere, holding another phone's lock, doesn't replace this one's.
    payload.settings.push({ key: SETTING_KEYS.appLock, value: { credentialId: 'other-phone', enabledAt: '2026-01-01T00:00:00Z' } })
    await importAll(JSON.parse(JSON.stringify(payload)))
    expect((await db.settings.get(SETTING_KEYS.appLock))?.value).toMatchObject({ credentialId: 'this-phone' })
  })
})

describe('validateExportPayload', () => {
  async function validPayload(): Promise<Record<string, unknown>> {
    await seedEverything()
    return JSON.parse(JSON.stringify(await exportAll()))
  }

  it('accepts a real export', async () => {
    expect(validateExportPayload(await validPayload()).ok).toBe(true)
  })

  it('rejects things that are not backups', () => {
    expect(validateExportPayload(null).ok).toBe(false)
    expect(validateExportPayload({ hello: 'world' }).ok).toBe(false)
    expect(validateExportPayload([]).ok).toBe(false)
  })

  it('rejects a backup from a newer version of the app, with a clear message', async () => {
    const payload = await validPayload()
    payload.version = EXPORT_VERSION + 1
    const result = validateExportPayload(payload)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/newer version/)
  })

  it('rejects photos that are not images', async () => {
    const payload = await validPayload()
    ;(payload.photos as Record<string, unknown>[])[0].mimeType = 'text/html'
    const result = validateExportPayload(payload)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/isn’t an image/)
  })

  it('rejects photo data that is not base64', async () => {
    const payload = await validPayload()
    ;(payload.photos as Record<string, unknown>[])[0].blobBase64 = '<script>alert(1)</script>'
    expect(validateExportPayload(payload).ok).toBe(false)
  })

  it('rejects rows with the wrong shape', async () => {
    const payload = await validPayload()
    ;(payload.challenges as Record<string, unknown>[])[0].status = 'paused'
    expect(validateExportPayload(payload).ok).toBe(false)
  })

  it('rejects a backup with an unknown challenge variant', async () => {
    const payload = await validPayload()
    ;(payload.challenges as Record<string, unknown>[])[0].variant = 'extreme'
    expect(validateExportPayload(payload).ok).toBe(false)
  })

  it('rejects a social day number outside the challenge', async () => {
    const payload = await validPayload()
    ;(payload.challenges as Record<string, unknown>[])[0].socialDays = [0]
    expect(validateExportPayload(payload).ok).toBe(false)
  })

  it('rejects a negative count of acknowledged jokers', async () => {
    const payload = await validPayload()
    ;(payload.challenges as Record<string, unknown>[])[0].jokersAcknowledged = -1
    expect(validateExportPayload(payload).ok).toBe(false)
  })

  it('rejects a give-up date that is not a real date', async () => {
    const payload = await validPayload()
    ;(payload.challenges as Record<string, unknown>[])[0].abandonedOn = '2026-02-30'
    expect(validateExportPayload(payload).ok).toBe(false)
  })

  it('rejects a day plan with an unknown task or an impossible time', async () => {
    const base = await validPayload()
    for (const plans of [{ reading: '25:00' }, { naps: '14:00' }, 'tonight']) {
      const payload = structuredClone(base)
      ;(payload.dayEntries as Record<string, unknown>[])[0].plans = plans
      expect(validateExportPayload(payload).ok).toBe(false)
    }
  })

  it('rejects a planEstimates with an unknown task key or a negative value', async () => {
    const base = await validPayload()
    for (const planEstimates of [{ naps: 5 }, { reading: -1 }]) {
      const payload = structuredClone(base)
      ;(payload.dayEntries as Record<string, unknown>[])[0].planEstimates = planEstimates
      expect(validateExportPayload(payload).ok).toBe(false)
    }
  })

  it('rejects a workout of an unknown activity, or a feel outside the five moods', async () => {
    const base = await validPayload()
    for (const change of [{ type: 'Boxing' }, { feel: 9 }, { feel: 'great' }]) {
      const payload = structuredClone(base)
      Object.assign((payload.workouts as Record<string, unknown>[])[0], change)
      expect(validateExportPayload(payload).ok).toBe(false)
    }
  })
})

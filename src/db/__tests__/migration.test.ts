// @vitest-environment node
import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { HardTrackerDB } from '../schema'

const NAME = 'MigrationTestDB'

/** Writes rows into a database created with the original v1 schema (no unique indexes). */
async function createV1Database(rows: {
  challenges: object[]
  dayEntries: object[]
  workouts?: object[]
  badges?: object[]
}): Promise<void> {
  const v1 = new Dexie(NAME)
  v1.version(1).stores({
    challenges: '++id, status, startDate, attemptNumber',
    dayEntries: '++id, challengeId, date, dayNumber, [challengeId+dayNumber]',
    workouts: '++id, dayEntryId',
    books: '++id, finished',
    measurements: '++id, date',
    photos: '++id, date',
    badges: '++id, challengeId, badgeId, [challengeId+badgeId]',
    settings: 'key',
  })
  await v1.open()
  await v1.table('challenges').bulkAdd(rows.challenges)
  await v1.table('dayEntries').bulkAdd(rows.dayEntries)
  await v1.table('workouts').bulkAdd(rows.workouts ?? [])
  await v1.table('badges').bulkAdd(rows.badges ?? [])
  v1.close()
}

const entry = (id: number, dayNumber: number, extra: object = {}) => ({
  id,
  challengeId: 1,
  date: `2026-09-${String(20 + dayNumber).padStart(2, '0')}`,
  dayNumber,
  water_ml: 0,
  pages_read: 0,
  dietFollowed: false,
  noAlcohol: false,
  completed: false,
  ...extra,
})

afterEach(async () => {
  await Dexie.delete(NAME)
})

describe('upgrading a v1 database', () => {
  it('merges duplicate days and badges, then enforces uniqueness', async () => {
    await createV1Database({
      challenges: [{ id: 1, startDate: '2026-09-21', attemptNumber: 1, status: 'active' }],
      dayEntries: [
        entry(1, 1, { water_ml: 3800, completed: false }),
        entry(2, 1, { pages_read: 10, dietFollowed: true, noAlcohol: true, photoId: 7 }), // StrictMode duplicate
        entry(3, 2),
      ],
      workouts: [
        { id: 1, dayEntryId: 2, type: 'Running', durationMin: 45, isOutdoor: true },
        { id: 2, dayEntryId: 2, type: 'Weights', durationMin: 60, isOutdoor: false },
      ],
      badges: [
        { id: 1, challengeId: 1, badgeId: 'first-photo', unlockedAt: '2026-09-21T10:00:00.000Z' },
        { id: 2, challengeId: 1, badgeId: 'first-photo', unlockedAt: '2026-09-21T09:00:00.000Z' },
      ],
    })

    const db = new HardTrackerDB(NAME)
    await db.open()

    const days = await db.dayEntries.orderBy('id').toArray()
    expect(days.map((d) => d.id)).toEqual([1, 3])
    // Day 1 now has everything from both copies — which makes it complete.
    expect(days[0]).toMatchObject({
      water_ml: 3800,
      pages_read: 10,
      dietFollowed: true,
      noAlcohol: true,
      photoId: 7,
      completed: true,
    })
    expect((await db.workouts.toArray()).map((w) => w.dayEntryId)).toEqual([1, 1])

    expect(await db.badges.toArray()).toEqual([expect.objectContaining({ id: 2, badgeId: 'first-photo' })])

    await expect(db.dayEntries.add({ ...entry(0, 2) } as never)).rejects.toMatchObject({ name: 'ConstraintError' })
    await expect(
      db.badges.add({ challengeId: 1, badgeId: 'first-photo', unlockedAt: 'x' } as never),
    ).rejects.toMatchObject({ name: 'ConstraintError' })
    db.close()
  })

  it('repairs broken start dates, stray active attempts and colliding attempt numbers', async () => {
    await createV1Database({
      challenges: [
        { id: 1, startDate: '2026-07-01', attemptNumber: 1, status: 'completed' },
        { id: 2, startDate: '', attemptNumber: 1, status: 'active' }, // the old Day-75 bug + a cleared date field
        { id: 3, startDate: '2026-09-22', attemptNumber: 2, status: 'active' },
      ],
      dayEntries: [{ ...entry(1, 1), challengeId: 2, date: '2026-09-20', dayNumber: null }],
    })

    const db = new HardTrackerDB(NAME)
    await db.open()

    const challenges = await db.challenges.orderBy('id').toArray()
    expect(challenges.map((c) => c.attemptNumber)).toEqual([1, 2, 3])
    expect(challenges[1]).toMatchObject({ startDate: '2026-09-20', status: 'failed' })
    expect(challenges[2]).toMatchObject({ status: 'active' })
    expect(await db.dayEntries.get(1)).toMatchObject({ dayNumber: 1 })
    db.close()
  })

  it('leaves clean data untouched', async () => {
    await createV1Database({
      challenges: [{ id: 1, startDate: '2026-09-21', attemptNumber: 1, status: 'active' }],
      dayEntries: [entry(1, 1, { completed: false }), entry(2, 2)],
    })

    const db = new HardTrackerDB(NAME)
    await db.open()
    expect(await db.dayEntries.toArray()).toEqual([entry(1, 1), entry(2, 2)])
    db.close()
  })
})

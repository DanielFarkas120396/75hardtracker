import { db } from '../db'
import type { Challenge, DayEntry, Photo, Workout } from '../types'
import { addDaysISO } from '../../lib/dates'
import { MIN_WORKOUT_MIN, PAGES_TARGET, WATER_TARGET_ML } from '../../logic/constants'

/** Wipes the test database and reopens it on the latest schema. */
export async function freshDatabase(): Promise<void> {
  db.close()
  await db.delete()
  await db.open()
}

export async function addChallenge(challenge: Omit<Challenge, 'id'>): Promise<number> {
  return db.challenges.add(challenge as Challenge)
}

export function jpegBytes(seed: number): Uint8Array<ArrayBuffer> {
  // A JPEG header followed by deterministic bytes — enough to check a byte-exact round trip.
  return Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, ...Array.from({ length: 64 }, (_, i) => (i * 7 + seed) % 256)])
}

/** Inserts completed days `fromDay`..`toDay` in one transaction (fast enough to seed 74 days). */
export async function addPerfectDays(challengeId: number, startDate: string, fromDay: number, toDay: number): Promise<void> {
  await db.transaction('rw', db.photos, db.dayEntries, db.workouts, async () => {
    for (let day = fromDay; day <= toDay; day++) await addPerfectDay(challengeId, startDate, day)
  })
}

/** Inserts a fully completed day (with a photo and two qualifying workouts) directly, bypassing the repositories. */
export async function addPerfectDay(challengeId: number, startDate: string, dayNumber: number): Promise<number> {
  const date = addDaysISO(startDate, dayNumber - 1)
  const photoId = await db.photos.add({ date, blob: new Blob([jpegBytes(dayNumber)], { type: 'image/jpeg' }) } as Photo)
  const entryId = await db.dayEntries.add({
    challengeId,
    date,
    dayNumber,
    water_ml: WATER_TARGET_ML,
    pages_read: PAGES_TARGET,
    dietFollowed: true,
    noAlcohol: true,
    photoId,
    completed: true,
  } as DayEntry)
  await db.workouts.bulkAdd([
    { dayEntryId: entryId, type: 'Running', durationMin: MIN_WORKOUT_MIN, isOutdoor: true },
    { dayEntryId: entryId, type: 'Weights', durationMin: MIN_WORKOUT_MIN, isOutdoor: false },
  ] as Workout[])
  return entryId
}

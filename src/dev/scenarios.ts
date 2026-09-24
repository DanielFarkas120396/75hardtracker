/**
 * Dev-only seeded scenarios for manual testing in the browser. Nothing in
 * the app imports this file, so it never reaches a production build.
 *
 * Open the app with a scratch database, then seed it from the console:
 *
 *   // at http://localhost:5173/?db=day75
 *   const s = await import('/src/dev/scenarios.ts')
 *   await s.seedDay75Pending()
 *
 * Every function refuses to run against the default database, and replaces
 * the scratch database's contents in a single transaction — so the running
 * app never sees an empty moment and bootstraps its own attempt.
 */
import { db, DEFAULT_DB_NAME } from '../db/db'
import type { Challenge, DayEntry, Photo, Workout } from '../db/types'
import { addDaysISO, todayISO } from '../lib/dates'
import { CHALLENGE_LENGTH, MIN_WORKOUT_MIN, PAGES_TARGET, WATER_TARGET_ML } from '../logic/constants'

interface SeedChallenge {
  challenge: Omit<Challenge, 'id'>
  days: SeedDay[]
}

interface SeedDay {
  dayNumber: number
  entry: Partial<Omit<DayEntry, 'id' | 'challengeId' | 'date' | 'dayNumber' | 'photoId'>>
  photo?: Blob
  workouts: Omit<Workout, 'id' | 'dayEntryId'>[]
}

/**
 * A small generated JPEG, so seeded days have real photo blobs for the
 * Gallery. Uses the synchronous toDataURL: toBlob never resolves while the
 * page is hidden.
 */
async function fakePhoto(label: string, hue: number): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = 240
  canvas.height = 320
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = `hsl(${hue} 70% 55%)`
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = 'white'
  ctx.font = 'bold 48px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(label, canvas.width / 2, canvas.height / 2)

  const base64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1]
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  return new Blob([bytes], { type: 'image/jpeg' })
}

/** Every task done: two qualifying workouts (one outdoor), diet, water, pages and a photo. */
async function perfectDay(dayNumber: number): Promise<SeedDay> {
  return {
    dayNumber,
    entry: {
      water_ml: WATER_TARGET_ML,
      pages_read: PAGES_TARGET,
      dietFollowed: true,
      noAlcohol: true,
      completed: true,
    },
    photo: await fakePhoto(`Day ${dayNumber}`, (dayNumber * 37) % 360),
    workouts: [
      { type: 'Running', durationMin: MIN_WORKOUT_MIN, isOutdoor: true },
      { type: 'Weights', durationMin: 60, isOutdoor: false },
    ],
  }
}

/** Replaces everything in the scratch database with the given challenges, atomically. */
async function replaceDatabase(seeds: SeedChallenge[]): Promise<void> {
  if (db.name === DEFAULT_DB_NAME) {
    throw new Error('Open the app with ?db=<scenario> first — scenarios never touch your real data.')
  }

  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()))

    for (const seed of seeds) {
      const challengeId = await db.challenges.add(seed.challenge as Challenge)
      for (const day of seed.days) {
        const date = addDaysISO(seed.challenge.startDate, day.dayNumber - 1)
        const photoId = day.photo ? await db.photos.add({ date, blob: day.photo } as Photo) : undefined
        const entryId = await db.dayEntries.add({
          challengeId,
          date,
          dayNumber: day.dayNumber,
          water_ml: 0,
          pages_read: 0,
          dietFollowed: false,
          noAlcohol: false,
          completed: false,
          ...day.entry,
          ...(photoId !== undefined ? { photoId } : {}),
        } as DayEntry)
        await db.workouts.bulkAdd(day.workouts.map((w) => ({ ...w, dayEntryId: entryId }) as Workout))
      }
    }
  })
}

/** Days 1–74 complete; Day 75 (today) has every task done except water (3.3 of 3.8 L). Tap +500 ml to finish. */
export async function seedDay75Pending(): Promise<void> {
  const days: SeedDay[] = []
  for (let day = 1; day <= CHALLENGE_LENGTH; day++) days.push(await perfectDay(day))
  const finalDay = days[CHALLENGE_LENGTH - 1]
  finalDay.entry = { ...finalDay.entry, water_ml: WATER_TARGET_ML - 500, completed: false }

  await replaceDatabase([
    {
      challenge: { startDate: addDaysISO(todayISO(), -(CHALLENGE_LENGTH - 1)), attemptNumber: 1, status: 'active' },
      days,
    },
  ])
}

/** Attempt #1 started yesterday and Day 1 was left incomplete, so today opens on the restart flow. */
export async function seedMissedDay(): Promise<void> {
  await replaceDatabase([
    {
      challenge: { startDate: addDaysISO(todayISO(), -1), attemptNumber: 1, status: 'active' },
      days: [
        {
          dayNumber: 1,
          entry: { water_ml: 2000, pages_read: PAGES_TARGET, dietFollowed: true, noAlcohol: true },
          photo: await fakePhoto('Day 1', 200),
          workouts: [{ type: 'Walking', durationMin: MIN_WORKOUT_MIN, isOutdoor: true }],
        },
      ],
    },
  ])
}

/** Days 1–3 complete and nothing logged yet on Day 4 (today): the streak should still show 3. */
export async function seedNewMorning(): Promise<void> {
  await replaceDatabase([
    {
      challenge: { startDate: addDaysISO(todayISO(), -3), attemptNumber: 1, status: 'active' },
      days: [await perfectDay(1), await perfectDay(2), await perfectDay(3)],
    },
  ])
}

/** A fresh attempt that starts `daysAhead` days from now (the "starts in N days" state). */
export async function seedPreStart(daysAhead = 3): Promise<void> {
  await replaceDatabase([
    { challenge: { startDate: addDaysISO(todayISO(), daysAhead), attemptNumber: 1, status: 'active' }, days: [] },
  ])
}

/** Day 1 is today with some progress logged (water and one workout) — for testing start-date moves. */
export async function seedDayOneWithLogs(): Promise<void> {
  await replaceDatabase([
    {
      challenge: { startDate: todayISO(), attemptNumber: 1, status: 'active' },
      days: [
        {
          dayNumber: 1,
          entry: { water_ml: 750 },
          workouts: [{ type: 'Walking', durationMin: MIN_WORKOUT_MIN, isOutdoor: true }],
        },
      ],
    },
  ])
}

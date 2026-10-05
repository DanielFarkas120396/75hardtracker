/**
 * Dev-only seeded scenarios for manual testing in the browser. The app only
 * reaches this file through dev-only time travel (src/dev/timeTravel.ts),
 * behind import.meta.env.DEV, so it never reaches a production build.
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
 *
 * Every scenario also writes a default profile (Sam), so it opens straight on
 * the app — except the two that are about the welcome flow.
 */
import { db, DEFAULT_DB_NAME } from '../db/db'
import { SETTING_KEYS } from '../db/repositories/settingsRepo'
import type { Challenge, DayEntry, Photo, Workout } from '../db/types'
import { addDaysISO, todayISO } from '../lib/dates'
import { CHALLENGE_LENGTH } from '../logic/constants'
import type { Profile } from '../logic/profile'
import { RULESETS } from '../logic/rulesets'

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
      water_ml: RULESETS.hard.waterTargetMl,
      pages_read: RULESETS.hard.pagesTarget,
      dietFollowed: true,
      noAlcohol: true,
      completed: true,
    },
    photo: await fakePhoto(`Day ${dayNumber}`, (dayNumber * 37) % 360),
    workouts: [
      { type: 'Running', durationMin: RULESETS.hard.minWorkoutMin, isOutdoor: true },
      { type: 'Weights', durationMin: 60, isOutdoor: false },
    ],
  }
}

/** The profile every scenario gets unless it's about the welcome flow, so it opens straight on the app. */
function scenarioProfile(): Profile {
  return { name: 'Sam', why: 'Prove I can finish what I start.', onboardedAt: new Date().toISOString() }
}

/** Replaces everything in the scratch database with the given challenges, atomically. */
async function replaceDatabase(seeds: SeedChallenge[], { withProfile = true }: { withProfile?: boolean } = {}): Promise<void> {
  if (db.name === DEFAULT_DB_NAME) {
    throw new Error('Open the app with ?db=<scenario> first — scenarios never touch your real data.')
  }

  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()))
    if (withProfile) await db.settings.put({ key: SETTING_KEYS.profile, value: scenarioProfile() })

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
  finalDay.entry = { ...finalDay.entry, water_ml: RULESETS.hard.waterTargetMl - 500, completed: false }

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
          entry: { water_ml: 2000, pages_read: RULESETS.hard.pagesTarget, dietFollowed: true, noAlcohol: true },
          photo: await fakePhoto('Day 1', 200),
          workouts: [{ type: 'Walking', durationMin: RULESETS.hard.minWorkoutMin, isOutdoor: true }],
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
          workouts: [{ type: 'Walking', durationMin: RULESETS.hard.minWorkoutMin, isOutdoor: true }],
        },
      ],
    },
  ])
}

/** Two qualifying workouts, one outdoors: Day 3's workouts task is done. */
const doneWorkouts: SeedDay['workouts'] = [
  { type: 'Running', durationMin: RULESETS.hard.minWorkoutMin, isOutdoor: true },
  { type: 'Weights', durationMin: 60, isOutdoor: false },
]

/**
 * Days 1–2 complete. Day 3 (today) has the workouts done, 2.1 L of water,
 * and the reading, photo and diet still to do. Open it with ?now=10:00,
 * ?now=20:00 or ?now=22:45 to see the duck watch, tap and hunt.
 */
export async function seedMenaceDay(): Promise<void> {
  await replaceDatabase([
    {
      challenge: { startDate: addDaysISO(todayISO(), -2), attemptNumber: 1, status: 'active' },
      days: [await perfectDay(1), await perfectDay(2), { dayNumber: 3, entry: { water_ml: 2100 }, workouts: doneWorkouts }],
    },
  ])
}

/**
 * Days 1–2 complete. On Day 3 (today) only the reading is left, planned for
 * 22:30. Open it with ?now=19:00 (plan pending), ?now=22:35 (plan due) or
 * ?now=23:10 (past bedtime: past-bedtime outranks the broken plan).
 */
export async function seedPlannedReading(): Promise<void> {
  await replaceDatabase([
    {
      challenge: { startDate: addDaysISO(todayISO(), -2), attemptNumber: 1, status: 'active' },
      days: [
        await perfectDay(1),
        await perfectDay(2),
        {
          dayNumber: 3,
          entry: {
            water_ml: RULESETS.hard.waterTargetMl,
            dietFollowed: true,
            noAlcohol: true,
            plans: { reading: '22:30' },
            planEstimates: { reading: 20 },
          },
          photo: await fakePhoto('Day 3', 120),
          workouts: doneWorkouts,
        },
      ],
    },
  ])
}

/**
 * A 75 Strong attempt on Day 3 (today), started 2 days ago. Days 1–2 are
 * perfect. Day 3 declares itself as this week's social occasion
 * (`socialDays: [3]`) and follows the diet with alcohol allowed, so Today
 * shows the social-occasion note and a complete diet task — nothing else is
 * logged yet, so the day itself isn't done.
 */
export async function seedStrongSocial(): Promise<void> {
  await replaceDatabase([
    {
      challenge: {
        startDate: addDaysISO(todayISO(), -2),
        attemptNumber: 1,
        status: 'active',
        variant: 'strong',
        socialDays: [3],
      },
      days: [
        await perfectDay(1),
        await perfectDay(2),
        { dayNumber: 3, entry: { dietFollowed: true, noAlcohol: false }, workouts: [] },
      ],
    },
  ])
}

/**
 * A 75 Medium attempt on Day 5 (today), started 4 days ago. Days 1, 2 and 4
 * are perfect; Day 3 has no entry at all, so it's a missed day. Medium's one
 * joker forgives it, and `jokersAcknowledged` is unset, so the app opens on
 * the joker screen.
 */
export async function seedMediumJoker(): Promise<void> {
  await replaceDatabase([
    {
      challenge: { startDate: addDaysISO(todayISO(), -4), attemptNumber: 1, status: 'active', variant: 'medium' },
      days: [await perfectDay(1), await perfectDay(2), await perfectDay(4)],
    },
  ])
}

/**
 * A 75 Soft attempt on Day 2 (today), started 1 day ago. Day 1 is perfect.
 * Day 2 takes its weekly recovery day (`restDay: true`) and also finishes
 * the diet, water and reading — only the photo is left.
 */
export async function seedSoftRestDay(): Promise<void> {
  await replaceDatabase([
    {
      challenge: { startDate: addDaysISO(todayISO(), -1), attemptNumber: 1, status: 'active', variant: 'soft' },
      days: [
        await perfectDay(1),
        {
          dayNumber: 2,
          entry: {
            restDay: true,
            water_ml: RULESETS.soft.waterTargetMl,
            pages_read: RULESETS.soft.pagesTarget,
            dietFollowed: true,
            noAlcohol: true,
          },
          workouts: [],
        },
      ],
    },
  ])
}

/**
 * A Hard attempt (no `variant`) that started 76 days ago, with all 75 days
 * perfect and `status` still `'active'`. Today is Day 77 — the case the
 * capped scan in evaluateChallenge fixes — so the app opens straight on
 * Victory instead of wrongly restarting.
 */
export async function seedDay77Complete(): Promise<void> {
  const days: SeedDay[] = []
  for (let day = 1; day <= CHALLENGE_LENGTH; day++) days.push(await perfectDay(day))

  await replaceDatabase([
    { challenge: { startDate: addDaysISO(todayISO(), -76), attemptNumber: 1, status: 'active' }, days },
  ])
}

/** A 75 Hard attempt with Days 1–11 perfect, given up today on Day 12: opens on the "You gave up" screen. */
export async function seedGaveUp(): Promise<void> {
  const days: SeedDay[] = []
  for (let day = 1; day <= 11; day++) days.push(await perfectDay(day))

  await replaceDatabase([
    {
      challenge: {
        startDate: addDaysISO(todayISO(), -11),
        attemptNumber: 1,
        status: 'abandoned',
        variant: 'hard',
        abandonedOn: todayISO(),
      },
      days,
    },
  ])
}

/** An empty database with no profile: opens on the welcome flow for a new player. */
export async function seedFreshInstall(): Promise<void> {
  await replaceDatabase([], { withProfile: false })
}

/**
 * 75 Hard on Day 4 with Days 1–3 done, but no profile yet — like the owner's
 * phone right after the welcome flow shipped: opens on the returning flow
 * (name and reason only).
 */
export async function seedReturningWithoutProfile(): Promise<void> {
  const days: SeedDay[] = []
  for (let day = 1; day <= 3; day++) days.push(await perfectDay(day))

  await replaceDatabase(
    [{ challenge: { startDate: addDaysISO(todayISO(), -3), attemptNumber: 1, status: 'active' }, days }],
    { withProfile: false },
  )
}

/**
 * Time travel: an attempt on Day `day`, every earlier day done and today
 * untouched. Past Day 75, all 75 days are done — the victory screen.
 */
export async function seedTravelDay(day: number): Promise<void> {
  const today = Math.min(Math.max(1, Math.floor(day)), CHALLENGE_LENGTH)
  const days: SeedDay[] = []
  for (let d = 1; d < today; d++) days.push(await perfectDay(d))
  if (day > CHALLENGE_LENGTH) days.push(await perfectDay(CHALLENGE_LENGTH))

  await replaceDatabase([
    { challenge: { startDate: addDaysISO(todayISO(), -(today - 1)), attemptNumber: 1, status: 'active' }, days },
  ])
}

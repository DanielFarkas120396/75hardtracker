import { addDaysISO, todayISO } from '@logic/dates'
import { RULESETS, type ChallengeVariant } from '@logic/rulesets'
import { SETTING_KEYS } from '@logic/settingKeys'
import type { Db } from '../db/driver'
import { transaction } from '../db/open'
import { challengeToParams, INSERT_CHALLENGE } from '../db/rows'
import { TABLE_NAMES } from '../db/schema'
import { insertRow } from '../db/table'

interface SeedOptions {
  variant?: ChallengeVariant
  /** Earlier days left with nothing logged; every other day before today is a perfect day. */
  missed?: readonly number[]
  /** Today has everything but its photo: one picture ends the day. */
  todayButPhoto?: boolean
}

/**
 * A day with every task done, or all but the photo. Its picture is a row without a file: nothing shows the earlier
 * days' photos yet.
 * ponytail: when the Gallery and the Journey's day cards arrive, write a real picture per day (the web's fakePhoto).
 */
async function insertDay(db: Db, challengeId: number, date: string, dayNumber: number, variant: ChallengeVariant, withPhoto: boolean): Promise<void> {
  const rules = RULESETS[variant]
  const photoId = withPhoto ? await insertRow(db, 'photos', { date, file: `seed-${dayNumber}.jpg`, mimeType: 'image/jpeg' }) : undefined
  const dayEntryId = await insertRow(db, 'dayEntries', {
    challengeId,
    date,
    dayNumber,
    water_ml: rules.waterTargetMl,
    pages_read: rules.pagesTarget,
    dietFollowed: true,
    noAlcohol: true,
    photoId,
    completed: withPhoto,
  })
  await insertRow(db, 'workouts', { dayEntryId, type: 'Running', durationMin: rules.minWorkoutMin, isOutdoor: true })
  if (rules.requiredWorkouts > 1) await insertRow(db, 'workouts', { dayEntryId, type: 'Weights', durationMin: rules.minWorkoutMin, isOutdoor: false })
}

/**
 * Developer tool: erases everything and starts an attempt (75 Hard unless told otherwise) whose Day `day` is today
 * (a day of 0 or less starts in the future), with its earlier days done and a profile, so the app opens on Today
 * instead of the welcome flow. Leaving days out (`missed`) opens on the screen for a missed day or a joker. The
 * fuller scenarios of the web app (src/dev/scenarios.ts) come with the screens they exercise.
 */
export async function seedDay(day: number, { variant = 'hard', missed = [], todayButPhoto = false }: SeedOptions = {}): Promise<void> {
  const startDate = addDaysISO(todayISO(), 1 - day)
  await transaction(async (db) => {
    for (const table of TABLE_NAMES) await db.execAsync(`DELETE FROM ${table}`)
    const challengeId = (await db.runAsync(INSERT_CHALLENGE, challengeToParams({ startDate, attemptNumber: 1, status: 'active', variant }))).lastInsertRowId
    for (let dayNumber = 1; dayNumber < day; dayNumber++) {
      if (!missed.includes(dayNumber)) await insertDay(db, challengeId, addDaysISO(startDate, dayNumber - 1), dayNumber, variant, true)
    }
    if (todayButPhoto && day >= 1) await insertDay(db, challengeId, todayISO(), day, variant, false)
    await db.runAsync('INSERT INTO settings (key, value) VALUES (?, ?)', [
      SETTING_KEYS.profile,
      JSON.stringify({ name: 'Tester', why: 'A seeded attempt', onboardedAt: new Date().toISOString() }),
    ])
  })
}

/** The endings, each one tap away: what the developer buttons in Settings offer. */
export const SEEDS: ReadonlyArray<{ label: string; run: () => Promise<void> }> = [
  { label: 'Seed Day 12', run: () => seedDay(12) },
  // Two days back, so it reads as missed at any time of day (yesterday stays open until noon).
  { label: 'Seed a missed day', run: () => seedDay(12, { missed: [10] }) },
  { label: 'Seed a joker', run: () => seedDay(12, { variant: 'medium', missed: [10] }) },
  { label: 'Seed Day 75', run: () => seedDay(75, { todayButPhoto: true }) },
]

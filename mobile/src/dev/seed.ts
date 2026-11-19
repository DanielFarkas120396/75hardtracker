import { addDaysISO, todayISO } from '@logic/dates'
import { Asset } from 'expo-asset'
import { RULESETS, type ChallengeVariant } from '@logic/rulesets'
import { SETTING_KEYS } from '@logic/settingKeys'
import type { Db } from '../db/driver'
import { transaction } from '../db/open'
import { challengeToParams, INSERT_CHALLENGE } from '../db/rows'
import { TABLE_NAMES } from '../db/schema'
import { insertRow, updateRow } from '../db/table'
import type { WorkoutType } from '../db/types'
import { picturePath } from '../files/pictures'
import { expoStore, type FileStore } from '../files/store'

interface SeedOptions {
  variant?: ChallengeVariant
  /** Earlier days left with nothing logged; every other day before today is a perfect day. */
  missed?: readonly number[]
  /** Today has everything but its photo: one picture ends the day. */
  todayButPhoto?: boolean
}

/** Three stand-in progress photos, bundled with the app, cycled through the seeded days. */
const PICTURES = [require('../../assets/images/seed/seed-1.jpg'), require('../../assets/images/seed/seed-2.jpg'), require('../../assets/images/seed/seed-3.jpg')]

/** A few lines, so the logbook's rows and cards have notes to show. */
const NOTES = [
  'Legs dead after the hill run.\nStill read my ten pages.',
  'Rain walk. Soaked, but done.',
  'Craved pizza all evening. Held on.',
  'Slept badly, trained anyway.',
  'Best session in weeks.',
]

/** Where a seed gets its pictures: the bundled files, copied into the app's pictures folder. */
export interface SeedFiles {
  store: FileStore
  /** A file URI for one of the bundled pictures. */
  picture: (index: number) => Promise<string>
}

const bundledFiles: SeedFiles = {
  store: expoStore,
  async picture(index) {
    const asset = await Asset.fromModule(PICTURES[index % PICTURES.length]).downloadAsync()
    if (!asset.localUri) throw new Error('A seed picture could not be read.')
    return asset.localUri
  },
}

/**
 * A day with every task done, or all but the photo. The workouts vary by day (the web's perfectDay), every other day
 * has a note, and each photo gets its picture once the rows are written (returned: photo id by day).
 */
async function insertDay(db: Db, challengeId: number, date: string, dayNumber: number, variant: ChallengeVariant, withPhoto: boolean): Promise<number | undefined> {
  const rules = RULESETS[variant]
  const photoId = withPhoto ? await insertRow(db, 'photos', { date, file: '', mimeType: 'image/jpeg' }) : undefined
  if (photoId !== undefined) await updateRow(db, 'photos', photoId, { file: `${photoId}.jpg` })
  const dayEntryId = await insertRow(db, 'dayEntries', {
    challengeId,
    date,
    dayNumber,
    water_ml: rules.waterTargetMl,
    pages_read: rules.pagesTarget,
    dietFollowed: true,
    noAlcohol: true,
    notes: dayNumber % 2 === 1 ? NOTES[Math.floor(dayNumber / 2) % NOTES.length] : undefined,
    photoId,
    completed: withPhoto,
  })
  const outdoor: WorkoutType = (['Running', 'Walking', 'Cycling'] as const)[dayNumber % 3]
  const indoor: WorkoutType = (['Weights', 'Yoga', 'Weights', 'Swimming'] as const)[dayNumber % 4]
  await insertRow(db, 'workouts', { dayEntryId, type: outdoor, durationMin: rules.minWorkoutMin + (dayNumber % 3) * 5, isOutdoor: true })
  if (rules.requiredWorkouts > 1) await insertRow(db, 'workouts', { dayEntryId, type: indoor, durationMin: 60, isOutdoor: false })
  return photoId
}

/**
 * Developer tool: erases everything and starts an attempt (75 Hard unless told otherwise) whose Day `day` is today
 * (a day of 0 or less starts in the future), with its earlier days done and a profile, so the app opens on Today
 * instead of the welcome flow. Leaving days out (`missed`) opens on the screen for a missed day or a joker. The
 * fuller scenarios of the web app (src/dev/scenarios.ts) come with the screens they exercise.
 */
export async function seedDay(day: number, { variant = 'hard', missed = [], todayButPhoto = false }: SeedOptions = {}, files: SeedFiles = bundledFiles): Promise<void> {
  const startDate = addDaysISO(todayISO(), 1 - day)
  const photoIds: number[] = []
  await transaction(async (db) => {
    for (const table of TABLE_NAMES) await db.execAsync(`DELETE FROM ${table}`)
    const challengeId = (await db.runAsync(INSERT_CHALLENGE, challengeToParams({ startDate, attemptNumber: 1, status: 'active', variant }))).lastInsertRowId
    for (let dayNumber = 1; dayNumber < day; dayNumber++) {
      if (missed.includes(dayNumber)) continue
      const photoId = await insertDay(db, challengeId, addDaysISO(startDate, dayNumber - 1), dayNumber, variant, true)
      if (photoId !== undefined) photoIds.push(photoId)
    }
    if (todayButPhoto && day >= 1) await insertDay(db, challengeId, todayISO(), day, variant, false)
    await db.runAsync('INSERT INTO settings (key, value) VALUES (?, ?)', [
      SETTING_KEYS.profile,
      JSON.stringify({ name: 'Tester', why: 'A seeded attempt', onboardedAt: new Date().toISOString() }),
    ])
  })
  // The pictures, once their rows are in: the old ones go, each photo gets one of the bundled three.
  files.store.deleteFolder(picturePath('photos', ''))
  files.store.deleteFolder(picturePath('covers', ''))
  for (const [i, photoId] of photoIds.entries()) await files.store.copyIn(await files.picture(i), picturePath('photos', `${photoId}.jpg`))
}

/** The endings and a long logbook, each one tap away: what the developer buttons in Settings offer. */
export const SEEDS: ReadonlyArray<{ label: string; run: () => Promise<void> }> = [
  { label: 'Seed Day 12', run: () => seedDay(12) },
  // Three worlds deep: a logbook to scroll on the Journey.
  { label: 'Seed Day 30', run: () => seedDay(30) },
  // Two days back, so it reads as missed at any time of day (yesterday stays open until noon).
  { label: 'Seed a missed day', run: () => seedDay(12, { missed: [10] }) },
  { label: 'Seed a joker', run: () => seedDay(12, { variant: 'medium', missed: [10] }) },
  { label: 'Seed Day 75', run: () => seedDay(75, { todayButPhoto: true }) },
]

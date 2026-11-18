import { isDayComplete, missingTasks, taskCompletionMap } from '@logic/dayCompletion'
import { isChallengeDay } from '@logic/days'
import { toDayTaskData } from '@logic/mappers'
import { bedtimeMinutes, DEFAULT_BEDTIME, formatHHmm } from '@logic/menace'
import type { Profile } from '@logic/profile'
import type { Ruleset } from '@logic/rulesets'
import { SETTING_KEYS } from '@logic/settingKeys'
import { useEffect } from 'react'
import { bookRepo } from '../db/repositories/bookRepo'
import { dayEntryRepo } from '../db/repositories/dayEntryRepo'
import { photoRepo } from '../db/repositories/photoRepo'
import { profileRepo } from '../db/repositories/profileRepo'
import { settingsRepo } from '../db/repositories/settingsRepo'
import { workoutRepo } from '../db/repositories/workoutRepo'
import type { Book, DayEntry, Photo, Workout } from '../db/types'
import { useLiveQuery } from '../db/useLiveQuery'

// The web's small hooks around a day (src/hooks/), on the phone's database.

/**
 * A day's entry, taken from the gate's live entries and created the first
 * time the day is opened. `undefined` while it's being created, and always
 * outside Day 1 to 75 (before the start), where no entry may exist.
 */
export function useDayEntry(params: { challengeId: number; dayNumber: number; date: string; dayEntries: DayEntry[] }): DayEntry | undefined {
  const { challengeId, dayNumber, date, dayEntries } = params
  const entry = isChallengeDay(dayNumber) ? dayEntries.find((e) => e.dayNumber === dayNumber) : undefined
  const missing = entry === undefined && isChallengeDay(dayNumber)

  useEffect(() => {
    if (missing) void dayEntryRepo.getOrCreate({ challengeId, dayNumber, date })
  }, [missing, challengeId, dayNumber, date])

  return entry
}

/** A day's workouts, live. `undefined` while reading or with no entry yet: "not ready", never "no workouts". */
export function useWorkoutsForEntry(dayEntryId: number | undefined): Workout[] | undefined {
  const read = useLiveQuery(
    async () => (dayEntryId === undefined ? null : { dayEntryId, workouts: await workoutRepo.getForDayEntry(dayEntryId) }),
    [dayEntryId],
  )
  // A read for another entry (the day just changed) is not this entry's.
  return read && read.dayEntryId === dayEntryId ? read.workouts : undefined
}

export type DayCompletion = ReturnType<typeof dayCompletion>

/** Each task's and the whole day's completion, from an entry and its workouts. */
export function dayCompletion(entry: DayEntry, workouts: Workout[], rules: Ruleset, socialDays: readonly number[] | undefined) {
  const data = toDayTaskData(entry, workouts, socialDays)
  return {
    data,
    completion: taskCompletionMap(data, rules),
    missing: missingTasks(data, rules),
    isComplete: isDayComplete(data, rules),
  }
}

/** The bedtime setting as "HH:mm" (23:00 unless set), or `undefined` until it has been read once. */
export function useBedtime(): string | undefined {
  const stored = useLiveQuery(async () => (await settingsRepo.get<unknown>(SETTING_KEYS.bedtime, DEFAULT_BEDTIME)) ?? DEFAULT_BEDTIME, [])
  return stored === undefined ? undefined : formatHHmm(bedtimeMinutes(stored))
}

/** Every book, and the one being read (the pages logged move its bookmark). A current book that no longer exists is simply none. */
export function useCurrentBook(): { books: Book[]; currentBook: Book | undefined } {
  const read = useLiveQuery(
    async () => ({ books: await bookRepo.getAll(), currentBookId: await settingsRepo.get<number | null>(SETTING_KEYS.currentBookId, null) }),
    [],
  )
  const books = read?.books ?? []
  return { books, currentBook: books.find((book) => book.id === read?.currentBookId) }
}

/** The photo row a day entry points to, live; undefined while reading or without one. */
export function useEntryPhoto(photoId: number | undefined): Photo | undefined {
  const read = useLiveQuery(async () => (photoId === undefined ? null : ((await photoRepo.getById(photoId)) ?? null)), [photoId])
  return read && read.id === photoId ? read : undefined
}

/** The player's profile, live; undefined while reading or without one. */
export function useProfile(): Profile | undefined {
  return useLiveQuery(async () => (await profileRepo.get()) ?? null, []) ?? undefined
}

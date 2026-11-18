/** @jest-environment node */
// Ported from the web app's src/db/__tests__/repositories.test.ts: same cases, same names.
// A photo here is a file: the tests give the repository a real file to copy.
import { addDaysISO } from '@logic/dates'
import { CHALLENGE_LENGTH } from '@logic/constants'
import { resolveChallengeGate } from '@logic/restart'
import { RULESETS } from '@logic/rulesets'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { nodeStore } from '../../../files/__tests__/nodeStore'
import type { FileStore } from '../../../files/store'
import { addChallenge, addPerfectDays, freshDatabase } from '../../__tests__/fixtures'
import { getDb, transaction } from '../../open'
import { allRows, getRow, insertRow } from '../../table'
import { bookRepo } from '../bookRepo'
import { dayEntryRepo } from '../dayEntryRepo'
import { measurementRepo } from '../measurementRepo'
import { photoRepo } from '../photoRepo'
import { workoutRepo } from '../workoutRepo'

const today = '2026-03-10'

let root: string
let store: FileStore
/** A picture as the camera hands it over: a file somewhere outside the app's pictures. */
function shot(seed = 1) {
  const path = join(root, `shot-${seed}.jpg`)
  writeFileSync(path, `picture ${seed}`)
  return { uri: pathToFileURL(path).href, mimeType: 'image/jpeg' }
}
const entryRow = (id: number) => getRow(getDb(), 'dayEntries', id)

beforeEach(async () => {
  await freshDatabase()
  root = mkdtempSync(join(tmpdir(), 'day-repos-'))
  store = nodeStore(root)
})

describe('dayEntryRepo.getOrCreate', () => {
  it('never creates duplicates under concurrent calls', async () => {
    const challengeId = await addChallenge({ startDate: today, attemptNumber: 1, status: 'active' })
    const results = await Promise.all(
      Array.from({ length: 5 }, () => dayEntryRepo.getOrCreate({ challengeId, dayNumber: 1, date: today })),
    )
    expect(new Set(results.map((e) => e.id)).size).toBe(1)
    expect(await dayEntryRepo.getAllForChallenge(challengeId)).toHaveLength(1)
  })

  it('refuses days outside the challenge', async () => {
    const challengeId = await addChallenge({ startDate: today, attemptNumber: 1, status: 'active' })
    await expect(dayEntryRepo.getOrCreate({ challengeId, dayNumber: 0, date: today })).rejects.toThrow(RangeError)
    await expect(dayEntryRepo.getOrCreate({ challengeId, dayNumber: 76, date: today })).rejects.toThrow(RangeError)
    await expect(dayEntryRepo.getOrCreate({ challengeId, dayNumber: Number.NaN, date: today })).rejects.toThrow(RangeError)
  })

  it('is backed by a unique index on [challengeId+dayNumber]', async () => {
    const challengeId = await addChallenge({ startDate: today, attemptNumber: 1, status: 'active' })
    const { id: _id, ...copy } = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 1, date: today })
    await expect(transaction((db) => insertRow(db, 'dayEntries', copy))).rejects.toThrow(/UNIQUE/)
  })

  it('creates the day empty, and finds it again', async () => {
    const challengeId = await addChallenge({ startDate: today, attemptNumber: 1, status: 'active' })
    const entry = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 1, date: today })
    expect(entry).toStrictEqual({
      id: entry.id,
      challengeId,
      date: today,
      dayNumber: 1,
      water_ml: 0,
      pages_read: 0,
      dietFollowed: false,
      noAlcohol: false,
      completed: false,
    })
    expect(await dayEntryRepo.getByChallengeAndDayNumber(challengeId, 1)).toStrictEqual(entry)
    expect(await dayEntryRepo.getByChallengeAndDayNumber(challengeId, 2)).toBeUndefined()
  })
})

describe('the completion flow', () => {
  it('completes Day 75 from real task logging', async () => {
    const startDate = addDaysISO(today, -(CHALLENGE_LENGTH - 1))
    const challengeId = await addChallenge({ startDate, attemptNumber: 1, status: 'active' })
    await addPerfectDays(challengeId, startDate, 1, CHALLENGE_LENGTH - 1)

    const entry = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: CHALLENGE_LENGTH, date: today })
    const isCompleted = async () => (await entryRow(entry.id))!.completed

    await dayEntryRepo.adjustWater(entry.id, 3800)
    await dayEntryRepo.adjustPages(entry.id, 10)
    await dayEntryRepo.update(entry.id, { dietFollowed: true, noAlcohol: true })
    await workoutRepo.add({ dayEntryId: entry.id, type: 'Running', durationMin: 45, isOutdoor: true })
    const shortWorkout = await workoutRepo.add({ dayEntryId: entry.id, type: 'Yoga', durationMin: 30, isOutdoor: false })
    expect(await isCompleted()).toBe(false) // the second workout is too short

    await workoutRepo.adjustDuration(shortWorkout, 15, 0, 300)
    expect(await isCompleted()).toBe(false) // still no photo

    await photoRepo.replaceForEntry(entry.id, shot(), store)
    expect(await isCompleted()).toBe(true) // all five tasks done

    await workoutRepo.remove(shortWorkout)
    expect(await isCompleted()).toBe(false) // un-doing a task un-completes the day
    await workoutRepo.add({ dayEntryId: entry.id, type: 'Cycling', durationMin: 50, isOutdoor: false })
    expect(await isCompleted()).toBe(true)

    const entries = await dayEntryRepo.getAllForChallenge(challengeId)
    expect(entries.map((e) => e.dayNumber)).toEqual(Array.from({ length: CHALLENGE_LENGTH }, (_, i) => i + 1))
    const gate = resolveChallengeGate({ currentStatus: 'active', dayEntries: entries, todayDayNumber: CHALLENGE_LENGTH, jokers: 0 })
    expect(gate.kind).toBe('completed')
  })
})

describe("completion follows the attempt's rules", () => {
  it('completes a day under Medium rules that would not complete under Hard, and un-completes on remove', async () => {
    const challengeId = await addChallenge({ startDate: today, attemptNumber: 1, status: 'active', variant: 'medium' })
    const entry = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 1, date: today })

    await dayEntryRepo.update(entry.id, { dietFollowed: true, noAlcohol: true })
    await dayEntryRepo.adjustWater(entry.id, 3000)
    await dayEntryRepo.adjustPages(entry.id, 10)
    const workoutId = await workoutRepo.add({ dayEntryId: entry.id, type: 'Weights', durationMin: 45, isOutdoor: false })
    await photoRepo.replaceForEntry(entry.id, shot(), store)

    // Under Hard rules this would stay false: one indoor workout, 3 L of water.
    expect((await entryRow(entry.id))!.completed).toBe(true)

    await workoutRepo.remove(workoutId)
    expect((await entryRow(entry.id))!.completed).toBe(false)
  })

  it('treats an attempt with no variant as Hard', async () => {
    const challengeId = await addChallenge({ startDate: today, attemptNumber: 1, status: 'active' })
    const entry = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 1, date: today })

    await dayEntryRepo.update(entry.id, { dietFollowed: true, noAlcohol: true })
    await dayEntryRepo.adjustWater(entry.id, 3000)
    await dayEntryRepo.adjustPages(entry.id, 10)
    await workoutRepo.add({ dayEntryId: entry.id, type: 'Weights', durationMin: 45, isOutdoor: false })
    await photoRepo.replaceForEntry(entry.id, shot(), store)

    expect((await entryRow(entry.id))!.completed).toBe(false)
  })
})

describe('the steppers', () => {
  it('water and pages never go below zero, and quick taps all count', async () => {
    const challengeId = await addChallenge({ startDate: today, attemptNumber: 1, status: 'active' })
    const entry = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 1, date: today })

    await Promise.all([250, 250, 250, 250].map((ml) => dayEntryRepo.adjustWater(entry.id, ml)))
    await Promise.all([1, 1, 1].map((pages) => dayEntryRepo.adjustPages(entry.id, pages)))
    expect(await entryRow(entry.id)).toMatchObject({ water_ml: 1000, pages_read: 3 })

    await dayEntryRepo.adjustWater(entry.id, -5000)
    await dayEntryRepo.adjustPages(entry.id, -5000)
    expect(await entryRow(entry.id)).toMatchObject({ water_ml: 0, pages_read: 0 })
  })

  it("a workout's length stays within its bounds", async () => {
    const challengeId = await addChallenge({ startDate: today, attemptNumber: 1, status: 'active' })
    const entry = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 1, date: today })
    const id = await workoutRepo.add({ dayEntryId: entry.id, type: 'Running', durationMin: 45, isOutdoor: true, feel: 4 })

    await workoutRepo.adjustDuration(id, 500, 0, 300)
    expect(await workoutRepo.getForDayEntry(entry.id)).toStrictEqual([
      { id, dayEntryId: entry.id, type: 'Running', durationMin: 300, isOutdoor: true, feel: 4 },
    ])
    await workoutRepo.adjustDuration(id, -500, 0, 300)
    await workoutRepo.update(id, { type: 'Yoga', isOutdoor: false, feel: undefined })
    expect(await workoutRepo.getForDayEntries([entry.id])).toStrictEqual([
      { id, dayEntryId: entry.id, type: 'Yoga', durationMin: 0, isOutdoor: false },
    ])
    expect(await workoutRepo.getForDayEntries([])).toEqual([])
  })

  it('a change to a workout that is gone does nothing', async () => {
    await workoutRepo.update(99, { durationMin: 60 })
    await workoutRepo.remove(99)
    expect(await allRows(getDb(), 'workouts')).toEqual([])
  })
})

describe('mood, notes and the book of the day', () => {
  it('saves and clears them, and they count as progress', async () => {
    const challengeId = await addChallenge({ startDate: today, attemptNumber: 1, status: 'active' })
    const entry = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 1, date: today })
    expect(await dayEntryRepo.hasLoggedProgress(challengeId)).toBe(false)

    await dayEntryRepo.update(entry.id, { mood: 4, notes: 'Legs are dead.' })
    await dayEntryRepo.setBook(entry.id, 7)
    expect(await entryRow(entry.id)).toMatchObject({ mood: 4, notes: 'Legs are dead.', bookId: 7 })
    expect(await dayEntryRepo.hasLoggedProgress(challengeId)).toBe(true)

    await dayEntryRepo.update(entry.id, { mood: undefined, notes: undefined })
    const cleared = await entryRow(entry.id)
    expect(cleared).not.toHaveProperty('mood')
    expect(cleared).not.toHaveProperty('notes')
    expect(await dayEntryRepo.hasLoggedProgress(challengeId)).toBe(false)

    await workoutRepo.add({ dayEntryId: entry.id, type: 'Walking', durationMin: 10, isOutdoor: true })
    expect(await dayEntryRepo.hasLoggedProgress(challengeId)).toBe(true)
  })
})

describe('photoRepo.replaceForEntry', () => {
  it('deletes the replaced photo so no orphaned picture is left', async () => {
    const challengeId = await addChallenge({ startDate: today, attemptNumber: 1, status: 'active' })
    const entry = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 1, date: today })

    const firstId = await photoRepo.replaceForEntry(entry.id, shot(1), store)
    expect(readFileSync(join(root, 'pictures', 'photos', `${firstId}.jpg`), 'utf8')).toBe('picture 1')
    const secondId = await photoRepo.replaceForEntry(entry.id, shot(2), store)

    expect(await photoRepo.getById(firstId)).toBeUndefined()
    expect(await allRows(getDb(), 'photos')).toStrictEqual([
      { id: secondId, date: today, file: `${secondId}.jpg`, mimeType: 'image/jpeg' },
    ])
    expect((await entryRow(entry.id))!.photoId).toBe(secondId)
    expect(existsSync(join(root, 'pictures', 'photos', `${firstId}.jpg`))).toBe(false)
    expect(readFileSync(join(root, 'pictures', 'photos', `${secondId}.jpg`), 'utf8')).toBe('picture 2')
  })

  it('keeps the day as it was when the picture cannot be copied', async () => {
    const challengeId = await addChallenge({ startDate: today, attemptNumber: 1, status: 'active' })
    const entry = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 1, date: today })
    const firstId = await photoRepo.replaceForEntry(entry.id, shot(1), store)

    const full: FileStore = { ...store, copyIn: () => Promise.reject(new Error('disk full')) }
    await expect(photoRepo.replaceForEntry(entry.id, shot(2), full)).rejects.toThrow('disk full')

    expect((await entryRow(entry.id))!.photoId).toBe(firstId)
    expect(await allRows(getDb(), 'photos')).toHaveLength(1)
    expect(readFileSync(join(root, 'pictures', 'photos', `${firstId}.jpg`), 'utf8')).toBe('picture 1')
  })

  it('refuses a day that does not exist', async () => {
    await expect(photoRepo.replaceForEntry(99, shot(), store)).rejects.toThrow('Day entry 99 not found')
    expect(await allRows(getDb(), 'photos')).toEqual([])
  })
})

describe('photoRepo.getLatestBefore', () => {
  it('returns the most recent photo dated before the given day, ignoring that day itself', async () => {
    await transaction(async (db) => {
      for (const date of [addDaysISO(today, -3), addDaysISO(today, -1), today]) {
        await insertRow(db, 'photos', { date, file: `${date}.jpg`, mimeType: 'image/jpeg' })
      }
    })

    expect((await photoRepo.getLatestBefore(today))?.date).toBe(addDaysISO(today, -1))
    expect(await photoRepo.getLatestBefore(addDaysISO(today, -3))).toBeUndefined()
  })
})

describe('measurementRepo.save', () => {
  it('keeps one weigh-in per date: logging a date again replaces its values', async () => {
    const first = await measurementRepo.save({ date: today, weight_kg: 82 })
    const again = await measurementRepo.save({ date: today, weight_kg: 81.6, bodyMeasurements_cm: { waist: 88 } })

    expect(first.ok && again.ok && first.id === again.id).toBe(true)
    expect(await measurementRepo.getAll()).toEqual([
      expect.objectContaining({ date: today, weight_kg: 81.6, bodyMeasurements_cm: { waist: 88 } }),
    ])
  })

  it("refuses to move an entry onto another entry's date", async () => {
    await measurementRepo.save({ date: '2026-09-01', weight_kg: 84 })
    const second = await measurementRepo.save({ date: '2026-09-08', weight_kg: 83 })
    if (!second.ok) throw new Error('expected the second weigh-in to save')

    expect(await measurementRepo.save({ date: '2026-09-01', weight_kg: 83 }, second.id)).toEqual({ ok: false, reason: 'dateTaken' })
    expect((await measurementRepo.getAll()).map((m) => m.weight_kg)).toEqual([84, 83])
  })

  it('edits an entry in place, including its date', async () => {
    const saved = await measurementRepo.save({ date: '2026-09-01', weight_kg: 84 })
    if (!saved.ok) throw new Error('expected the weigh-in to save')
    await measurementRepo.save({ date: '2026-09-02', weight_kg: 83.8 }, saved.id)
    expect(await measurementRepo.getAll()).toEqual([expect.objectContaining({ id: saved.id, date: '2026-09-02', weight_kg: 83.8 })])
  })

  it('a weigh-in saved again without body measurements loses them', async () => {
    await measurementRepo.save({ date: today, weight_kg: 82, bodyMeasurements_cm: { waist: 88 } })
    await measurementRepo.save({ date: today, weight_kg: 81.9 })
    expect((await measurementRepo.getAll())[0]).not.toHaveProperty('bodyMeasurements_cm')
  })
})

describe('measurementRepo reads', () => {
  it("finds a date's weigh-in, and the latest weight", async () => {
    expect(await measurementRepo.getByDate('2026-09-02')).toBeUndefined()
    expect(await measurementRepo.getLatestWeight()).toBeUndefined()

    await measurementRepo.save({ date: '2026-09-08', weight_kg: 83 })
    const older = await measurementRepo.save({ date: '2026-09-02', weight_kg: 84 })

    expect(await measurementRepo.getByDate('2026-09-02')).toMatchObject({ date: '2026-09-02', weight_kg: 84 })
    expect(await measurementRepo.getLatestWeight()).toBe(83)

    if (older.ok) await measurementRepo.remove(older.id)
    expect(await measurementRepo.getByDate('2026-09-02')).toBeUndefined()
  })
})

describe('bookRepo finish tracking', () => {
  it('stamps finishedAt when the last page is reached and clears it when stepping back', async () => {
    const id = await bookRepo.add({ title: 'Deep Work', totalPages: 20, currentPage: 15 })

    await bookRepo.adjustCurrentPage(id, 10)
    const finished = await bookRepo.getById(id)
    expect(finished).toMatchObject({ currentPage: 20, finished: true })
    expect(finished!.finishedAt).toEqual(expect.any(String))

    await bookRepo.adjustCurrentPage(id, 5) // already finished: the stamp is kept
    expect((await bookRepo.getById(id))!.finishedAt).toBe(finished!.finishedAt)

    await bookRepo.adjustCurrentPage(id, -1)
    const reopened = await bookRepo.getById(id)
    expect(reopened).toMatchObject({ currentPage: 19, finished: false })
    expect(reopened!.finishedAt).toBeUndefined()
  })

  it('recomputes finished state when page counts are edited', async () => {
    const id = await bookRepo.add({ title: 'Atomic Habits', totalPages: 300, currentPage: 280 })
    await bookRepo.update(id, { totalPages: 250 })
    expect(await bookRepo.getById(id)).toMatchObject({ totalPages: 250, currentPage: 250, finished: true })
  })

  it('marks a book finished when it is added on its last page', async () => {
    const id = await bookRepo.add({ title: 'Mindset', totalPages: 280, currentPage: 280 })
    const book = await bookRepo.getById(id)
    expect(book).toMatchObject({ finished: true })
    expect(book!.finishedAt).toEqual(expect.any(String))
  })

  it('lists the books, and never moves a bookmark before the first page', async () => {
    const id = await bookRepo.add({ title: 'Deep Work', totalPages: 296, currentPage: 3 })
    await bookRepo.adjustCurrentPage(id, -10)
    expect(await bookRepo.getAll()).toStrictEqual([{ id, title: 'Deep Work', totalPages: 296, currentPage: 0, finished: false }])
  })
})

describe('dayEntryRepo.getAllForChallenges', () => {
  it('returns the entries of exactly the given attempts', async () => {
    const first = await addChallenge({ startDate: '2026-01-01', attemptNumber: 1, status: 'failed' })
    const second = await addChallenge({ startDate: '2026-02-01', attemptNumber: 2, status: 'failed' })
    const third = await addChallenge({ startDate: '2026-03-01', attemptNumber: 3, status: 'active' })
    await addPerfectDays(first, '2026-01-01', 1, 2)
    await addPerfectDays(second, '2026-02-01', 1, 3)
    await addPerfectDays(third, '2026-03-01', 1, 1)

    const entries = await dayEntryRepo.getAllForChallenges([first, third])
    const days = entries.map((e) => [e.challengeId, e.dayNumber]).sort((a, b) => a[0] - b[0] || a[1] - b[1])
    expect(days).toEqual([
      [first, 1],
      [first, 2],
      [third, 1],
    ])
    expect(await dayEntryRepo.getAllForChallenges([])).toEqual([])
    expect(await dayEntryRepo.getAllWithPhoto()).toHaveLength(6)
  })
})

describe('dayEntryRepo.setPlans', () => {
  it('saves a day plan, drops malformed times, and removes an empty plan', async () => {
    const challengeId = await addChallenge({ startDate: today, attemptNumber: 1, status: 'active' })
    const entry = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 1, date: today })

    await dayEntryRepo.setPlans(entry.id, { reading: '22:30', workouts: '25:00' })
    expect((await entryRow(entry.id))?.plans).toEqual({ reading: '22:30' })

    await dayEntryRepo.setPlans(entry.id, {})
    expect(await entryRow(entry.id)).not.toHaveProperty('plans')
  })

  it('round-trips the estimate frozen for each planned task', async () => {
    const challengeId = await addChallenge({ startDate: today, attemptNumber: 1, status: 'active' })
    const entry = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 1, date: today })

    await dayEntryRepo.setPlans(entry.id, { reading: '22:30', photo: '21:00' }, { reading: 20, photo: 2 })
    expect((await entryRow(entry.id))?.planEstimates).toEqual({ reading: 20, photo: 2 })
  })

  it('drops an estimate for a task with no plan, and any negative or non-finite estimate', async () => {
    const challengeId = await addChallenge({ startDate: today, attemptNumber: 1, status: 'active' })
    const entry = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 1, date: today })

    // photo has no plan, so its estimate is dropped even though it's a valid number.
    await dayEntryRepo.setPlans(entry.id, { reading: '22:30' }, { reading: 20, photo: 5 })
    expect((await entryRow(entry.id))?.planEstimates).toEqual({ reading: 20 })

    // Both tasks are planned now, but a negative and a non-finite estimate are both dropped.
    await dayEntryRepo.setPlans(entry.id, { reading: '22:30', photo: '21:00' }, { reading: -1, photo: Number.NaN })
    expect(await entryRow(entry.id)).not.toHaveProperty('planEstimates')
  })

  it('removes both plans and planEstimates when the plan becomes empty', async () => {
    const challengeId = await addChallenge({ startDate: today, attemptNumber: 1, status: 'active' })
    const entry = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 1, date: today })

    await dayEntryRepo.setPlans(entry.id, { reading: '22:30' }, { reading: 20 })
    await dayEntryRepo.setPlans(entry.id, {})

    const stored = await entryRow(entry.id)
    expect(stored).not.toHaveProperty('plans')
    expect(stored).not.toHaveProperty('planEstimates')
  })
})

describe('recovery days', () => {
  it("completes the day's workouts task", async () => {
    const startDate = addDaysISO(today, -2) // today is Day 3
    const challengeId = await addChallenge({ startDate, attemptNumber: 1, status: 'active', variant: 'soft' })
    const day2 = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 2, date: addDaysISO(startDate, 1) })
    await dayEntryRepo.update(day2.id, { dietFollowed: true, noAlcohol: true })
    await dayEntryRepo.adjustWater(day2.id, RULESETS.soft.waterTargetMl)
    await dayEntryRepo.adjustPages(day2.id, RULESETS.soft.pagesTarget)
    await photoRepo.replaceForEntry(day2.id, shot(), store)

    expect(await dayEntryRepo.setRestDay(day2.id, true)).toEqual({ ok: true })
    expect((await entryRow(day2.id))?.completed).toBe(true)
  })

  it('refuses a second recovery day in the same challenge week', async () => {
    const startDate = addDaysISO(today, -2)
    const challengeId = await addChallenge({ startDate, attemptNumber: 1, status: 'active', variant: 'soft' })
    const day2 = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 2, date: addDaysISO(startDate, 1) })
    const day3 = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 3, date: today })
    await dayEntryRepo.setRestDay(day2.id, true)

    expect(await dayEntryRepo.setRestDay(day3.id, true)).toEqual({ ok: false, reason: 'week-taken', dayNumber: 2 })
  })

  it('clears the field and re-syncs when taken back', async () => {
    const startDate = addDaysISO(today, -2)
    const challengeId = await addChallenge({ startDate, attemptNumber: 1, status: 'active', variant: 'soft' })
    const day2 = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 2, date: addDaysISO(startDate, 1) })
    await dayEntryRepo.setRestDay(day2.id, true)

    expect(await dayEntryRepo.setRestDay(day2.id, false)).toEqual({ ok: true })
    const entry = await entryRow(day2.id)
    expect(entry).not.toHaveProperty('restDay')
    expect(entry?.completed).toBe(false)
  })

  it('refuses on a Medium challenge', async () => {
    const startDate = addDaysISO(today, -2)
    const challengeId = await addChallenge({ startDate, attemptNumber: 1, status: 'active', variant: 'medium' })
    const day2 = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 2, date: addDaysISO(startDate, 1) })

    expect(await dayEntryRepo.setRestDay(day2.id, true)).toEqual({ ok: false, reason: 'not-allowed' })
    expect(await dayEntryRepo.setRestDay(99, true)).toEqual({ ok: false, reason: 'not-allowed' })
  })
})

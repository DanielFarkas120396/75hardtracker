// @vitest-environment node
// (Node's Blob survives IndexedDB's structured clone; jsdom's doesn't.)
import { beforeEach, describe, expect, it } from 'vitest'
import { addDaysISO, todayISO } from '../../lib/dates'
import { CHALLENGE_LENGTH } from '../../logic/constants'
import { resolveChallengeGate } from '../../logic/restart'
import { RULESETS } from '../../logic/rulesets'
import { db } from '../db'
import { badgeRepo } from '../repositories/badgeRepo'
import { bookRepo } from '../repositories/bookRepo'
import { challengeRepo } from '../repositories/challengeRepo'
import { dayEntryRepo } from '../repositories/dayEntryRepo'
import { measurementRepo } from '../repositories/measurementRepo'
import { photoRepo } from '../repositories/photoRepo'
import { profileRepo } from '../repositories/profileRepo'
import { SETTING_KEYS, settingsRepo } from '../repositories/settingsRepo'
import { workoutRepo } from '../repositories/workoutRepo'
import type { DayEntry, Photo, Workout } from '../types'
import { addChallenge, addPerfectDays, freshDatabase, jpegBytes } from './fixtures'

const today = todayISO()
const photoBlob = (seed = 1) => new Blob([jpegBytes(seed)], { type: 'image/jpeg' })

beforeEach(freshDatabase)

describe('challengeRepo.bootstrapIfEmpty', () => {
  it('creates attempt #1 once, even when called concurrently', async () => {
    await Promise.all([
      challengeRepo.bootstrapIfEmpty(today),
      challengeRepo.bootstrapIfEmpty(today),
      challengeRepo.bootstrapIfEmpty(today),
    ])
    const challenges = await db.challenges.toArray()
    expect(challenges).toHaveLength(1)
    expect(challenges[0]).toMatchObject({ attemptNumber: 1, status: 'active', startDate: today })
  })

  it('does nothing when any challenge exists — even a completed one', async () => {
    await addChallenge({ startDate: '2026-01-01', attemptNumber: 1, status: 'completed' })
    await challengeRepo.bootstrapIfEmpty(today)
    expect(await db.challenges.count()).toBe(1)
  })
})

describe('challengeRepo.restart', () => {
  it('archives the attempt and starts attempt max + 1', async () => {
    await addChallenge({ startDate: '2026-01-01', attemptNumber: 3, status: 'completed' })
    const failedId = await addChallenge({ startDate: '2026-06-01', attemptNumber: 4, status: 'active' })

    const newId = await challengeRepo.restart(failedId, today)

    expect(await db.challenges.get(failedId)).toMatchObject({ status: 'failed' })
    expect(await db.challenges.get(newId)).toMatchObject({ attemptNumber: 5, status: 'active', startDate: today })
  })

  it('never leaves two active challenges, even when tapped twice at once', async () => {
    const failedId = await addChallenge({ startDate: '2026-06-01', attemptNumber: 1, status: 'active' })

    const ids = await Promise.all([challengeRepo.restart(failedId, today), challengeRepo.restart(failedId, today)])

    const active = await db.challenges.where('status').equals('active').toArray()
    expect(active).toHaveLength(1)
    expect(ids[0]).toBe(ids[1])
    expect(await db.challenges.count()).toBe(2)
  })
})

describe('dayEntryRepo.getOrCreate', () => {
  it('never creates duplicates under concurrent calls', async () => {
    const challengeId = await addChallenge({ startDate: today, attemptNumber: 1, status: 'active' })
    const results = await Promise.all(
      Array.from({ length: 5 }, () => dayEntryRepo.getOrCreate({ challengeId, dayNumber: 1, date: today })),
    )
    expect(new Set(results.map((e) => e.id)).size).toBe(1)
    expect(await db.dayEntries.count()).toBe(1)
  })

  it('refuses days outside the challenge', async () => {
    const challengeId = await addChallenge({ startDate: today, attemptNumber: 1, status: 'active' })
    await expect(dayEntryRepo.getOrCreate({ challengeId, dayNumber: 0, date: today })).rejects.toThrow(RangeError)
    await expect(dayEntryRepo.getOrCreate({ challengeId, dayNumber: 76, date: today })).rejects.toThrow(RangeError)
    await expect(dayEntryRepo.getOrCreate({ challengeId, dayNumber: Number.NaN, date: today })).rejects.toThrow(
      RangeError,
    )
  })

  it('is backed by a unique index on [challengeId+dayNumber]', async () => {
    const challengeId = await addChallenge({ startDate: today, attemptNumber: 1, status: 'active' })
    const entry = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 1, date: today })
    const { id: _id, ...copy } = entry
    await expect(db.dayEntries.add(copy as typeof entry)).rejects.toMatchObject({ name: 'ConstraintError' })
  })
})

describe('the completion flow', () => {
  it('completes Day 75 from real task logging, then starts attempt #2 without a stray attempt', async () => {
    const startDate = addDaysISO(today, -(CHALLENGE_LENGTH - 1))
    const challengeId = await addChallenge({ startDate, attemptNumber: 1, status: 'active' })
    await addPerfectDays(challengeId, startDate, 1, CHALLENGE_LENGTH - 1)

    const entry = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: CHALLENGE_LENGTH, date: today })
    const isCompleted = async () => (await db.dayEntries.get(entry.id))!.completed

    await dayEntryRepo.adjustWater(entry.id, 3800)
    await dayEntryRepo.adjustPages(entry.id, 10)
    await dayEntryRepo.update(entry.id, { dietFollowed: true, noAlcohol: true })
    await workoutRepo.add({ dayEntryId: entry.id, type: 'Running', durationMin: 45, isOutdoor: true })
    const shortWorkout = await workoutRepo.add({ dayEntryId: entry.id, type: 'Yoga', durationMin: 30, isOutdoor: false })
    expect(await isCompleted()).toBe(false) // the second workout is too short

    await workoutRepo.adjustDuration(shortWorkout, 15, 0, 300)
    expect(await isCompleted()).toBe(false) // still no photo

    await photoRepo.replaceForEntry(entry.id, photoBlob())
    expect(await isCompleted()).toBe(true) // all five tasks done

    await workoutRepo.remove(shortWorkout)
    expect(await isCompleted()).toBe(false) // un-doing a task un-completes the day
    await workoutRepo.add({ dayEntryId: entry.id, type: 'Cycling', durationMin: 50, isOutdoor: false })
    expect(await isCompleted()).toBe(true)

    const entries = await dayEntryRepo.getAllForChallenge(challengeId)
    const gate = resolveChallengeGate({
      currentStatus: 'active',
      dayEntries: entries,
      todayDayNumber: CHALLENGE_LENGTH,
      jokers: 0,
    })
    expect(gate.kind).toBe('completed')

    await challengeRepo.markCompleted(challengeId)
    await challengeRepo.bootstrapIfEmpty(today) // what the app does when nothing is active
    expect(await db.challenges.toArray()).toEqual([
      expect.objectContaining({ id: challengeId, attemptNumber: 1, status: 'completed' }),
    ])

    const nextId = await challengeRepo.startNew(today, 'hard')
    expect(await db.challenges.get(nextId)).toMatchObject({ attemptNumber: 2, status: 'active', startDate: today })
    expect(await db.challenges.where('status').equals('active').count()).toBe(1)
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
    await photoRepo.replaceForEntry(entry.id, photoBlob())

    // Under Hard rules this would stay false: one indoor workout, 3 L of water.
    expect((await db.dayEntries.get(entry.id))!.completed).toBe(true)

    await workoutRepo.remove(workoutId)
    expect((await db.dayEntries.get(entry.id))!.completed).toBe(false)
  })

  it('treats an attempt with no variant as Hard', async () => {
    const challengeId = await addChallenge({ startDate: today, attemptNumber: 1, status: 'active' })
    const entry = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 1, date: today })

    await dayEntryRepo.update(entry.id, { dietFollowed: true, noAlcohol: true })
    await dayEntryRepo.adjustWater(entry.id, 3000)
    await dayEntryRepo.adjustPages(entry.id, 10)
    await workoutRepo.add({ dayEntryId: entry.id, type: 'Weights', durationMin: 45, isOutdoor: false })
    await photoRepo.replaceForEntry(entry.id, photoBlob())

    expect((await db.dayEntries.get(entry.id))!.completed).toBe(false)
  })
})

describe('challengeRepo.changeStartDate', () => {
  it('moves a Day-1 start into the future and clears what was logged', async () => {
    const challengeId = await addChallenge({ startDate: today, attemptNumber: 1, status: 'active' })
    const entry = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 1, date: today })
    await dayEntryRepo.adjustWater(entry.id, 500)
    await workoutRepo.add({ dayEntryId: entry.id, type: 'Walking', durationMin: 45, isOutdoor: true })
    await photoRepo.replaceForEntry(entry.id, photoBlob())
    await badgeRepo.unlockMissing(challengeId, ['first-workout'])

    const tomorrow = addDaysISO(today, 1)
    expect(await challengeRepo.changeStartDate(challengeId, tomorrow, today)).toEqual({ ok: true })

    expect(await db.challenges.get(challengeId)).toMatchObject({ startDate: tomorrow })
    expect(await db.dayEntries.count()).toBe(0)
    expect(await db.workouts.count()).toBe(0)
    expect(await db.photos.count()).toBe(0)
    expect(await db.badges.count()).toBe(0)
  })

  it('rejects a past date and leaves everything alone', async () => {
    const challengeId = await addChallenge({ startDate: today, attemptNumber: 1, status: 'active' })
    await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 1, date: today })

    const result = await challengeRepo.changeStartDate(challengeId, addDaysISO(today, -1), today)

    expect(result).toEqual({ ok: false, reason: 'past' })
    expect(await db.challenges.get(challengeId)).toMatchObject({ startDate: today })
    expect(await db.dayEntries.count()).toBe(1)
  })

  it('is locked from Day 2 on', async () => {
    const challengeId = await addChallenge({ startDate: addDaysISO(today, -1), attemptNumber: 1, status: 'active' })
    expect(await challengeRepo.changeStartDate(challengeId, addDaysISO(today, 3), today)).toEqual({
      ok: false,
      reason: 'locked',
    })
  })

  it('never saves an empty date', async () => {
    const challengeId = await addChallenge({ startDate: today, attemptNumber: 1, status: 'active' })
    expect(await challengeRepo.changeStartDate(challengeId, '', today)).toEqual({ ok: false, reason: 'empty' })
    expect(await db.challenges.get(challengeId)).toMatchObject({ startDate: today })
  })

  it('shifts a declared social day so it keeps its calendar date when the start moves later', async () => {
    const challengeId = await addChallenge({
      startDate: today,
      attemptNumber: 1,
      status: 'active',
      variant: 'medium',
      socialDays: [6],
    })
    const tomorrow = addDaysISO(today, 1)

    expect(await challengeRepo.changeStartDate(challengeId, tomorrow, today)).toEqual({ ok: true })

    expect((await db.challenges.get(challengeId))?.socialDays).toEqual([5])
  })

  it('drops a declared day that would land before Day 1 once the start moves', async () => {
    const challengeId = await addChallenge({
      startDate: today,
      attemptNumber: 1,
      status: 'active',
      variant: 'medium',
      socialDays: [2],
    })
    const later = addDaysISO(today, 3)

    expect(await challengeRepo.changeStartDate(challengeId, later, today)).toEqual({ ok: true })

    expect(await db.challenges.get(challengeId)).not.toHaveProperty('socialDays')
  })
})

describe('photoRepo.replaceForEntry', () => {
  it('deletes the replaced photo so no orphaned blob is left', async () => {
    const challengeId = await addChallenge({ startDate: today, attemptNumber: 1, status: 'active' })
    const entry = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 1, date: today })

    const firstId = await photoRepo.replaceForEntry(entry.id, photoBlob(1))
    const secondId = await photoRepo.replaceForEntry(entry.id, photoBlob(2))

    expect(await db.photos.get(firstId)).toBeUndefined()
    expect(await db.photos.count()).toBe(1)
    expect((await db.dayEntries.get(entry.id))!.photoId).toBe(secondId)
  })
})

describe('badgeRepo.unlockMissing', () => {
  it('unlocks each badge once and reports only what it added, even concurrently', async () => {
    const challengeId = await addChallenge({ startDate: today, attemptNumber: 1, status: 'active' })

    const [a, b] = await Promise.all([
      badgeRepo.unlockMissing(challengeId, ['first-workout', 'first-photo']),
      badgeRepo.unlockMissing(challengeId, ['first-photo', 'first-workout']),
    ])

    expect([...a, ...b].sort()).toEqual(['first-photo', 'first-workout'])
    expect(await db.badges.count()).toBe(2)
    expect(await badgeRepo.unlockMissing(challengeId, ['first-photo'])).toEqual([])
  })

  it('scopes badges per attempt', async () => {
    const first = await addChallenge({ startDate: '2026-01-01', attemptNumber: 1, status: 'failed' })
    const second = await addChallenge({ startDate: today, attemptNumber: 2, status: 'active' })
    await badgeRepo.unlockMissing(first, ['first-photo'])
    expect(await badgeRepo.unlockMissing(second, ['first-photo'])).toEqual(['first-photo'])
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

    expect(await measurementRepo.save({ date: '2026-09-01', weight_kg: 83 }, second.id)).toEqual({
      ok: false,
      reason: 'dateTaken',
    })
    expect((await measurementRepo.getAll()).map((m) => m.weight_kg)).toEqual([84, 83])
  })

  it('edits an entry in place, including its date', async () => {
    const saved = await measurementRepo.save({ date: '2026-09-01', weight_kg: 84 })
    if (!saved.ok) throw new Error('expected the weigh-in to save')
    await measurementRepo.save({ date: '2026-09-02', weight_kg: 83.8 }, saved.id)
    expect(await measurementRepo.getAll()).toEqual([expect.objectContaining({ id: saved.id, date: '2026-09-02', weight_kg: 83.8 })])
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
})

describe('bookRepo.remove', () => {
  it('clears the current book when that book is deleted, and only then', async () => {
    const reading = await bookRepo.add({ title: 'Deep Work', totalPages: 296, currentPage: 40 })
    const other = await bookRepo.add({ title: 'Mindset', totalPages: 280, currentPage: 0 })
    await settingsRepo.set(SETTING_KEYS.currentBookId, reading)

    await bookRepo.remove(other)
    expect(await settingsRepo.get(SETTING_KEYS.currentBookId, null)).toBe(reading)

    await bookRepo.remove(reading)
    expect(await bookRepo.getAll()).toEqual([])
    expect(await settingsRepo.get(SETTING_KEYS.currentBookId, null)).toBeNull()
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
  })
})

describe('dayEntryRepo.setPlans', () => {
  it('saves a day plan, drops malformed times, and removes an empty plan', async () => {
    const challengeId = await addChallenge({ startDate: today, attemptNumber: 1, status: 'active' })
    const entry = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 1, date: today })

    await dayEntryRepo.setPlans(entry.id, { reading: '22:30', workouts: '25:00' })
    expect((await db.dayEntries.get(entry.id))?.plans).toEqual({ reading: '22:30' })

    await dayEntryRepo.setPlans(entry.id, {})
    expect(await db.dayEntries.get(entry.id)).not.toHaveProperty('plans')
  })

  it('round-trips the estimate frozen for each planned task', async () => {
    const challengeId = await addChallenge({ startDate: today, attemptNumber: 1, status: 'active' })
    const entry = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 1, date: today })

    await dayEntryRepo.setPlans(entry.id, { reading: '22:30', photo: '21:00' }, { reading: 20, photo: 2 })
    expect((await db.dayEntries.get(entry.id))?.planEstimates).toEqual({ reading: 20, photo: 2 })
  })

  it('drops an estimate for a task with no plan, and any negative or non-finite estimate', async () => {
    const challengeId = await addChallenge({ startDate: today, attemptNumber: 1, status: 'active' })
    const entry = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 1, date: today })

    // photo has no plan, so its estimate is dropped even though it's a valid number.
    await dayEntryRepo.setPlans(entry.id, { reading: '22:30' }, { reading: 20, photo: 5 })
    expect((await db.dayEntries.get(entry.id))?.planEstimates).toEqual({ reading: 20 })

    // Both tasks are planned now, but a negative and a non-finite estimate are both dropped.
    await dayEntryRepo.setPlans(entry.id, { reading: '22:30', photo: '21:00' }, { reading: -1, photo: Number.NaN })
    expect(await db.dayEntries.get(entry.id)).not.toHaveProperty('planEstimates')
  })

  it('removes both plans and planEstimates when the plan becomes empty', async () => {
    const challengeId = await addChallenge({ startDate: today, attemptNumber: 1, status: 'active' })
    const entry = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 1, date: today })

    await dayEntryRepo.setPlans(entry.id, { reading: '22:30' }, { reading: 20 })
    await dayEntryRepo.setPlans(entry.id, {})

    const stored = await db.dayEntries.get(entry.id)
    expect(stored).not.toHaveProperty('plans')
    expect(stored).not.toHaveProperty('planEstimates')
  })
})

describe('social occasions', () => {
  it('declares a future day within the week', async () => {
    const challengeId = await addChallenge({
      startDate: addDaysISO(today, -2), // today is Day 3
      attemptNumber: 1,
      status: 'active',
      variant: 'strong',
    })
    expect(await challengeRepo.setSocialDay(challengeId, 4, true, today)).toEqual({ ok: true })
    expect((await db.challenges.get(challengeId))?.socialDays).toEqual([4])
  })

  it('refuses to declare today or a day already past', async () => {
    const challengeId = await addChallenge({
      startDate: addDaysISO(today, -2),
      attemptNumber: 1,
      status: 'active',
      variant: 'strong',
    })
    expect(await challengeRepo.setSocialDay(challengeId, 3, true, today)).toEqual({ ok: false, reason: 'too-late' })
    expect(await challengeRepo.setSocialDay(challengeId, 2, true, today)).toEqual({ ok: false, reason: 'too-late' })
  })

  it('refuses a second declaration in the same challenge week', async () => {
    const challengeId = await addChallenge({
      startDate: addDaysISO(today, -2),
      attemptNumber: 1,
      status: 'active',
      variant: 'strong',
    })
    await challengeRepo.setSocialDay(challengeId, 4, true, today)
    expect(await challengeRepo.setSocialDay(challengeId, 5, true, today)).toEqual({
      ok: false,
      reason: 'week-taken',
      dayNumber: 4,
    })
  })

  it('allows a declaration in a later challenge week', async () => {
    const challengeId = await addChallenge({
      startDate: addDaysISO(today, -2),
      attemptNumber: 1,
      status: 'active',
      variant: 'strong',
    })
    await challengeRepo.setSocialDay(challengeId, 4, true, today)
    expect(await challengeRepo.setSocialDay(challengeId, 8, true, today)).toEqual({ ok: true })
  })

  it('refuses a day outside the challenge', async () => {
    const challengeId = await addChallenge({
      startDate: addDaysISO(today, -2),
      attemptNumber: 1,
      status: 'active',
      variant: 'strong',
    })
    expect(await challengeRepo.setSocialDay(challengeId, 76, true, today)).toEqual({
      ok: false,
      reason: 'out-of-range',
    })
  })

  it('refuses on a Hard challenge', async () => {
    const challengeId = await addChallenge({
      startDate: addDaysISO(today, -2),
      attemptNumber: 1,
      status: 'active',
      variant: 'hard',
    })
    expect(await challengeRepo.setSocialDay(challengeId, 4, true, today)).toEqual({ ok: false, reason: 'not-allowed' })
  })

  it('is idempotent when declared twice', async () => {
    const challengeId = await addChallenge({
      startDate: addDaysISO(today, -2),
      attemptNumber: 1,
      status: 'active',
      variant: 'strong',
    })
    await challengeRepo.setSocialDay(challengeId, 4, true, today)
    expect(await challengeRepo.setSocialDay(challengeId, 4, true, today)).toEqual({ ok: true })
    expect((await db.challenges.get(challengeId))?.socialDays).toEqual([4])
  })

  it('cancelling empties the day and removes the field', async () => {
    const challengeId = await addChallenge({
      startDate: addDaysISO(today, -2),
      attemptNumber: 1,
      status: 'active',
      variant: 'strong',
    })
    await challengeRepo.setSocialDay(challengeId, 4, true, today)
    expect(await challengeRepo.setSocialDay(challengeId, 4, false, today)).toEqual({ ok: true })
    expect(await db.challenges.get(challengeId)).not.toHaveProperty('socialDays')
  })

  it('refuses to cancel a day already in the past', async () => {
    const challengeId = await addChallenge({
      startDate: addDaysISO(today, -2),
      attemptNumber: 1,
      status: 'active',
      variant: 'strong',
      socialDays: [2],
    })
    expect(await challengeRepo.setSocialDay(challengeId, 2, false, today)).toEqual({ ok: false, reason: 'too-late' })
  })

  it("cancelling today's occasion re-syncs today", async () => {
    const startDate = addDaysISO(today, -2)
    const challengeId = await addChallenge({
      startDate,
      attemptNumber: 1,
      status: 'active',
      variant: 'strong',
      socialDays: [3],
    })
    const photoId = await db.photos.add({ date: today, blob: new Blob([jpegBytes(3)], { type: 'image/jpeg' }) } as Photo)
    const entryId = await db.dayEntries.add({
      challengeId,
      date: today,
      dayNumber: 3,
      water_ml: RULESETS.strong.waterTargetMl,
      pages_read: RULESETS.strong.pagesTarget,
      dietFollowed: true,
      noAlcohol: false,
      photoId,
      completed: true,
    } as DayEntry)
    await db.workouts.bulkAdd([
      { dayEntryId: entryId, type: 'Running', durationMin: RULESETS.strong.minWorkoutMin, isOutdoor: true },
      { dayEntryId: entryId, type: 'Weights', durationMin: RULESETS.strong.minWorkoutMin, isOutdoor: false },
    ] as Workout[])

    expect(await challengeRepo.setSocialDay(challengeId, 3, false, today)).toEqual({ ok: true })
    expect((await db.dayEntries.get(entryId))?.completed).toBe(false)
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
    await photoRepo.replaceForEntry(day2.id, photoBlob())

    expect(await dayEntryRepo.setRestDay(day2.id, true)).toEqual({ ok: true })
    expect((await db.dayEntries.get(day2.id))?.completed).toBe(true)
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
    const entry = await db.dayEntries.get(day2.id)
    expect(entry).not.toHaveProperty('restDay')
    expect(entry?.completed).toBe(false)
  })

  it('refuses on a Medium challenge', async () => {
    const startDate = addDaysISO(today, -2)
    const challengeId = await addChallenge({ startDate, attemptNumber: 1, status: 'active', variant: 'medium' })
    const day2 = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 2, date: addDaysISO(startDate, 1) })

    expect(await dayEntryRepo.setRestDay(day2.id, true)).toEqual({ ok: false, reason: 'not-allowed' })
  })
})

describe('changing the variant', () => {
  it('switches on Day 1; switching to Hard clears social days and rest days, and re-judges Day 1', async () => {
    const challengeId = await addChallenge({ startDate: today, attemptNumber: 1, status: 'active', variant: 'medium' })
    const entry = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 1, date: today })

    expect(await challengeRepo.changeVariant(challengeId, 'soft', today)).toEqual({ ok: true })
    expect((await db.challenges.get(challengeId))?.variant).toBe('soft')

    await challengeRepo.setSocialDay(challengeId, 4, true, today)
    await dayEntryRepo.setRestDay(entry.id, true)
    await dayEntryRepo.update(entry.id, { dietFollowed: true, noAlcohol: true })
    await dayEntryRepo.adjustWater(entry.id, RULESETS.soft.waterTargetMl)
    await dayEntryRepo.adjustPages(entry.id, RULESETS.soft.pagesTarget)
    await photoRepo.replaceForEntry(entry.id, photoBlob())
    expect((await db.dayEntries.get(entry.id))?.completed).toBe(true)

    expect(await challengeRepo.changeVariant(challengeId, 'hard', today)).toEqual({ ok: true })

    const challenge = await db.challenges.get(challengeId)
    expect(challenge?.variant).toBe('hard')
    expect(challenge).not.toHaveProperty('socialDays')
    const updatedEntry = await db.dayEntries.get(entry.id)
    expect(updatedEntry).not.toHaveProperty('restDay')
    expect(updatedEntry?.completed).toBe(false)
  })

  it('is locked from Day 2 on', async () => {
    const challengeId = await addChallenge({
      startDate: addDaysISO(today, -1),
      attemptNumber: 1,
      status: 'active',
      variant: 'medium',
    })
    expect(await challengeRepo.changeVariant(challengeId, 'soft', today)).toEqual({ ok: false, reason: 'locked' })
  })
})

describe('starting attempts', () => {
  it('bootstrapIfEmpty writes variant hard', async () => {
    await challengeRepo.bootstrapIfEmpty(today)
    const [challenge] = await db.challenges.toArray()
    expect(challenge.variant).toBe('hard')
  })

  it('startNew writes the given variant', async () => {
    const id = await challengeRepo.startNew(today, 'medium')
    expect((await db.challenges.get(id))?.variant).toBe('medium')
  })

  it('restart keeps a Soft attempt Soft', async () => {
    const failedId = await addChallenge({
      startDate: addDaysISO(today, -1),
      attemptNumber: 1,
      status: 'active',
      variant: 'soft',
    })
    const newId = await challengeRepo.restart(failedId, today)
    expect((await db.challenges.get(newId))?.variant).toBe('soft')
  })

  it('restart of a variant-less attempt starts Hard, leaving the old row without a variant key', async () => {
    const failedId = await addChallenge({ startDate: addDaysISO(today, -1), attemptNumber: 1, status: 'active' })
    const newId = await challengeRepo.restart(failedId, today)
    expect((await db.challenges.get(newId))?.variant).toBe('hard')
    expect(await db.challenges.get(failedId)).not.toHaveProperty('variant')
  })
})

describe('giving up', () => {
  it('changes only the status and the give-up date, leaving a pre-variants attempt variant-less', async () => {
    const startDate = addDaysISO(today, -11)
    const challengeId = await addChallenge({ startDate, attemptNumber: 1, status: 'active' })
    await addPerfectDays(challengeId, startDate, 1, 11)
    const before = await db.challenges.get(challengeId)
    const entriesBefore = await db.dayEntries.where('challengeId').equals(challengeId).toArray()

    expect(await challengeRepo.giveUp(challengeId, today)).toEqual({ ok: true })

    expect(await db.challenges.get(challengeId)).toEqual({ ...before, status: 'abandoned', abandonedOn: today })
    expect(await db.challenges.get(challengeId)).not.toHaveProperty('variant')
    expect(await db.dayEntries.where('challengeId').equals(challengeId).toArray()).toEqual(entriesBefore)
  })

  it('works from Day 1 to Day 75', async () => {
    const dayOne = await addChallenge({ startDate: today, attemptNumber: 1, status: 'active', variant: 'soft' })
    expect(await challengeRepo.giveUp(dayOne, today)).toEqual({ ok: true })

    const lastDay = await addChallenge({
      startDate: addDaysISO(today, -(CHALLENGE_LENGTH - 1)),
      attemptNumber: 2,
      status: 'active',
    })
    expect(await challengeRepo.giveUp(lastDay, today)).toEqual({ ok: true })
  })

  it('is locked before Day 1 and after Day 75', async () => {
    const challengeId = await addChallenge({ startDate: addDaysISO(today, 1), attemptNumber: 1, status: 'active' })
    expect(await challengeRepo.giveUp(challengeId, today)).toEqual({ ok: false, reason: 'locked' })

    await db.challenges.update(challengeId, { startDate: addDaysISO(today, -CHALLENGE_LENGTH) }) // today is Day 76
    expect(await challengeRepo.giveUp(challengeId, today)).toEqual({ ok: false, reason: 'locked' })
    expect((await db.challenges.get(challengeId))?.status).toBe('active')
  })

  it('is locked on an attempt that is no longer active, or that does not exist', async () => {
    const completed = await addChallenge({ startDate: addDaysISO(today, -3), attemptNumber: 1, status: 'completed' })
    expect(await challengeRepo.giveUp(completed, today)).toEqual({ ok: false, reason: 'locked' })
    expect((await db.challenges.get(completed))?.status).toBe('completed')
    expect(await challengeRepo.giveUp(completed + 1, today)).toEqual({ ok: false, reason: 'locked' })
  })

  it('stays the current attempt until startNew begins the next one, numbered after it', async () => {
    const givenUp = await addChallenge({ startDate: addDaysISO(today, -4), attemptNumber: 3, status: 'active' })
    await challengeRepo.giveUp(givenUp, today)
    expect(await challengeRepo.getCurrent()).toMatchObject({ id: givenUp, status: 'abandoned', abandonedOn: today })

    const nextId = await challengeRepo.startNew(addDaysISO(today, 1), 'medium')

    expect(await db.challenges.get(nextId)).toMatchObject({
      attemptNumber: 4,
      status: 'active',
      variant: 'medium',
      startDate: addDaysISO(today, 1),
    })
    expect((await challengeRepo.getCurrent())?.id).toBe(nextId)
  })
})

describe('acknowledging jokers', () => {
  it('only grows, never shrinks', async () => {
    const challengeId = await addChallenge({ startDate: today, attemptNumber: 1, status: 'active', variant: 'soft' })

    await challengeRepo.acknowledgeJokers(challengeId, 1)
    expect((await db.challenges.get(challengeId))?.jokersAcknowledged).toBe(1)

    await challengeRepo.acknowledgeJokers(challengeId, 0)
    expect((await db.challenges.get(challengeId))?.jokersAcknowledged).toBe(1)
  })
})

describe('the profile', () => {
  const now = new Date('2026-09-28T08:00:00.000Z')

  it('is undefined until the welcome flow is done', async () => {
    expect(await profileRepo.get()).toBeUndefined()
  })

  it('completes the flow for a new player: attempt #1 with the chosen challenge and start, then the profile', async () => {
    const result = await profileRepo.completeOnboarding(
      { name: ' Daniel ', why: 'A fresh start' },
      { startDate: addDaysISO(today, 1), variant: 'medium' },
      now,
    )

    expect(result).toEqual({ ok: true })
    expect(await db.challenges.toArray()).toMatchObject([
      { attemptNumber: 1, status: 'active', variant: 'medium', startDate: addDaysISO(today, 1) },
    ])
    expect(await profileRepo.get()).toEqual({ name: 'Daniel', why: 'A fresh start', onboardedAt: now.toISOString() })
  })

  it('never adds an attempt when one exists already, and never touches it', async () => {
    const challengeId = await addChallenge({ startDate: addDaysISO(today, -3), attemptNumber: 1, status: 'active' })
    const before = await db.challenges.get(challengeId)

    await profileRepo.completeOnboarding({ name: 'Daniel', why: 'A fresh start' }, { startDate: today, variant: 'soft' }, now)

    expect(await db.challenges.toArray()).toEqual([before])
  })

  it('saves only the profile for a returning player', async () => {
    const challengeId = await addChallenge({ startDate: addDaysISO(today, -3), attemptNumber: 1, status: 'active' })
    const before = await db.challenges.get(challengeId)

    await profileRepo.completeOnboarding({ name: 'Daniel', why: 'A fresh start' }, undefined, now)

    expect(await db.challenges.toArray()).toEqual([before])
    expect(await profileRepo.get()).toMatchObject({ name: 'Daniel', why: 'A fresh start' })
  })

  it('writes nothing when the name or the reason is unusable', async () => {
    const firstAttempt = { startDate: today, variant: 'hard' as const }
    expect(await profileRepo.completeOnboarding({ name: '  ', why: 'A fresh start' }, firstAttempt)).toEqual({
      ok: false,
      reason: 'invalid',
    })
    expect(await profileRepo.completeOnboarding({ name: 'Daniel', why: '' }, firstAttempt)).toEqual({
      ok: false,
      reason: 'invalid',
    })
    expect(await db.challenges.count()).toBe(0)
    expect(await profileRepo.get()).toBeUndefined()
  })

  it('updates the name and the reason, keeping when the flow was done', async () => {
    await profileRepo.completeOnboarding({ name: 'Daniel', why: 'A fresh start' }, undefined, now)

    expect(await profileRepo.save({ name: 'Dan', why: 'Clear my head' }, new Date('2026-10-01T08:00:00.000Z'))).toEqual({
      ok: true,
    })
    expect(await profileRepo.get()).toEqual({ name: 'Dan', why: 'Clear my head', onboardedAt: now.toISOString() })

    expect(await profileRepo.save({ name: 'x'.repeat(21), why: 'Clear my head' })).toEqual({ ok: false, reason: 'invalid' })
    expect(await profileRepo.get()).toMatchObject({ name: 'Dan' })
  })
})

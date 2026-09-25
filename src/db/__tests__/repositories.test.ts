// @vitest-environment node
// (Node's Blob survives IndexedDB's structured clone; jsdom's doesn't.)
import { beforeEach, describe, expect, it } from 'vitest'
import { addDaysISO, todayISO } from '../../lib/dates'
import { CHALLENGE_LENGTH } from '../../logic/constants'
import { resolveChallengeGate } from '../../logic/restart'
import { db } from '../db'
import { badgeRepo } from '../repositories/badgeRepo'
import { bookRepo } from '../repositories/bookRepo'
import { challengeRepo } from '../repositories/challengeRepo'
import { dayEntryRepo } from '../repositories/dayEntryRepo'
import { measurementRepo } from '../repositories/measurementRepo'
import { photoRepo } from '../repositories/photoRepo'
import { workoutRepo } from '../repositories/workoutRepo'
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
    const gate = resolveChallengeGate({ currentStatus: 'active', dayEntries: entries, todayDayNumber: CHALLENGE_LENGTH })
    expect(gate.kind).toBe('completed')

    await challengeRepo.markCompleted(challengeId)
    await challengeRepo.bootstrapIfEmpty(today) // what the app does when nothing is active
    expect(await db.challenges.toArray()).toEqual([
      expect.objectContaining({ id: challengeId, attemptNumber: 1, status: 'completed' }),
    ])

    const nextId = await challengeRepo.startNew(today)
    expect(await db.challenges.get(nextId)).toMatchObject({ attemptNumber: 2, status: 'active', startDate: today })
    expect(await db.challenges.where('status').equals('active').count()).toBe(1)
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
    const id = await bookRepo.add({ title: 'Deep Work', totalPages: 20, currentPage: 15, finished: false })

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
    const id = await bookRepo.add({ title: 'Atomic Habits', totalPages: 300, currentPage: 280, finished: false })
    await bookRepo.update(id, { totalPages: 250 })
    expect(await bookRepo.getById(id)).toMatchObject({ totalPages: 250, currentPage: 250, finished: true })
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

// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import { resolveGate } from '../../hooks/useChallengeGate'
import { addDaysISO, todayISO } from '../../lib/dates'
import { resolveChallengeGate } from '../../logic/restart'
import { rulesFor } from '../../logic/rulesets'
import { calculateChallengeStats } from '../../logic/stats'
import { calculateStreak } from '../../logic/streak'
import { loadChallengeDays } from '../challengeDays'
import { COMPLETION_TABLES, syncDayCompletion } from '../completion'
import { db } from '../db'
import { challengeRepo } from '../repositories/challengeRepo'
import { dayEntryRepo } from '../repositories/dayEntryRepo'
import { addChallenge, addPerfectDays, freshDatabase } from './fixtures'

beforeEach(freshDatabase)

// A live 75 Hard attempt, started before the `variant` field existed. This proves the
// per-ruleset plumbing (rulesFor, syncDayCompletion, loadChallengeDays, calculateChallengeStats)
// judges it exactly as the old hardcoded-75-Hard code would have.
describe('a pre-variants 75 Hard attempt', () => {
  it('is judged exactly as it was before rulesets existed', async () => {
    const today = todayISO()
    const startDate = addDaysISO(today, -11) // today is Day 12

    const challengeId = await addChallenge({ startDate, attemptNumber: 1, status: 'active' })
    await addPerfectDays(challengeId, startDate, 1, 11)

    const day12 = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 12, date: today })
    await dayEntryRepo.adjustWater(day12.id, 3000)
    await dayEntryRepo.adjustPages(day12.id, 10)
    await dayEntryRepo.setPlans(day12.id, { photo: '21:00' }, { photo: 2 })

    const challengesSnapshot = await db.challenges.toArray()
    const dayEntriesSnapshot = await db.dayEntries.toArray()
    const workoutsSnapshot = await db.workouts.toArray()
    const photosCountSnapshot = await db.photos.count()

    const allEntries = await dayEntryRepo.getAllForChallenge(challengeId)
    await db.transaction('rw', COMPLETION_TABLES, async () => {
      for (const entry of allEntries) await syncDayCompletion(entry.id)
    })

    // Re-syncing every entry moves nothing: the pre-variants data was already correct.
    expect(await db.dayEntries.toArray()).toEqual(dayEntriesSnapshot)
    expect(await db.challenges.toArray()).toEqual(challengesSnapshot)
    expect(await db.workouts.toArray()).toEqual(workoutsSnapshot)
    expect(await db.photos.count()).toBe(photosCountSnapshot)

    const challengeRow = (await db.challenges.get(challengeId))!
    const gate = resolveChallengeGate({
      currentStatus: 'active',
      dayEntries: allEntries,
      todayDayNumber: 12,
      jokers: rulesFor(challengeRow).jokers,
    })
    expect(gate).toEqual({ kind: 'active', missed: [] })

    expect(calculateStreak(allEntries, 12)).toBe(11)

    const { rules, days } = await loadChallengeDays(challengeId)
    // 11 perfect days x 75, plus the Day-7 streak-milestone bonus of 100, plus Day 12's reading (10);
    // under Medium or Soft its 3 L would also count (945).
    expect(calculateChallengeStats(days, rules)).toMatchObject({ xp: 935, perfectDays: 11 })

    expect('variant' in challengeRow).toBe(false)
  })

  it('challengeRepo.setSocialDay refuses it and leaves the row untouched', async () => {
    const today = todayISO()
    const startDate = addDaysISO(today, -11)
    const challengeId = await addChallenge({ startDate, attemptNumber: 1, status: 'active' })
    const before = await db.challenges.get(challengeId)

    expect(await challengeRepo.setSocialDay(challengeId, 5, true, today)).toEqual({
      ok: false,
      reason: 'not-allowed',
    })
    expect(await db.challenges.get(challengeId)).toEqual(before)
  })

  it('every other new write path refuses it too, leaving the whole database untouched', async () => {
    const today = todayISO()
    const startDate = addDaysISO(today, -11) // today is Day 12
    const challengeId = await addChallenge({ startDate, attemptNumber: 1, status: 'active' })
    await addPerfectDays(challengeId, startDate, 1, 11)
    const day12 = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 12, date: today })

    const challengesSnapshot = await db.challenges.toArray()
    const dayEntriesSnapshot = await db.dayEntries.toArray()
    const workoutsSnapshot = await db.workouts.toArray()

    expect(await challengeRepo.changeVariant(challengeId, 'soft', today)).toEqual({ ok: false, reason: 'locked' })
    expect(await dayEntryRepo.setRestDay(day12.id, true)).toEqual({ ok: false, reason: 'not-allowed' })
    await challengeRepo.acknowledgeJokers(challengeId, 0)

    expect(await db.challenges.toArray()).toEqual(challengesSnapshot)
    expect(await db.dayEntries.toArray()).toEqual(dayEntriesSnapshot)
    expect(await db.workouts.toArray()).toEqual(workoutsSnapshot)

    const challengeRow = (await db.challenges.get(challengeId))!
    const allEntries = await dayEntryRepo.getAllForChallenge(challengeId)
    const gate = resolveGate(challengeRow, allEntries, today)
    expect(gate).toMatchObject({ kind: 'active', missedDays: [], jokersLeft: 0 })
  })
})

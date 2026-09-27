// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import { addDaysISO, todayISO } from '../../lib/dates'
import { loadBadgeEvaluation } from '../badgeEvaluation'
import { db } from '../db'
import { dayEntryRepo } from '../repositories/dayEntryRepo'
import type { Book, Challenge } from '../types'
import { addChallenge, freshDatabase } from './fixtures'

beforeEach(freshDatabase)

const today = todayISO()

async function currentAttempt(): Promise<Challenge> {
  await addChallenge({ startDate: addDaysISO(today, -30), attemptNumber: 1, status: 'failed' })
  const id = await addChallenge({ startDate: today, attemptNumber: 2, status: 'active' })
  return (await db.challenges.get(id))!
}

describe('Bookworm across attempts', () => {
  it('ignores books finished before the current attempt started', async () => {
    const attempt = await currentAttempt()
    await db.books.add({
      title: 'Finished during attempt #1',
      totalPages: 100,
      currentPage: 100,
      finished: true,
      finishedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    } as Book)
    await db.books.add({ title: 'Finished before tracking', totalPages: 50, currentPage: 50, finished: true } as Book)

    const { context } = await loadBadgeEvaluation(attempt, 1)
    expect(context.booksFinished).toBe(0)
  })

  it('counts a book finished during the current attempt', async () => {
    const attempt = await currentAttempt()
    await db.books.add({
      title: 'Finished today',
      totalPages: 100,
      currentPage: 100,
      finished: true,
      finishedAt: new Date().toISOString(),
    } as Book)

    const { context } = await loadBadgeEvaluation(attempt, 1)
    expect(context.booksFinished).toBe(1)
  })
})

describe('a variant changed after the caller loaded the challenge', () => {
  it('judges badges by the rules stored now, not the rules on the stale challenge object', async () => {
    const challengeId = await addChallenge({ startDate: today, attemptNumber: 1, status: 'active' })
    const staleChallenge = (await db.challenges.get(challengeId))! // captured before the variant change below: no `variant`, so Hard

    const day1 = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 1, date: today })
    await dayEntryRepo.adjustWater(day1.id, 3000)

    await db.challenges.update(challengeId, { variant: 'medium' })

    // Medium's target is 3 L, so today's 3000 ml should count — even though the object
    // passed in is the pre-update one, which still looks like a variant-less Hard attempt.
    const { context } = await loadBadgeEvaluation(staleChallenge, 1)
    expect(context.waterGoalDays).toBe(1)
  })
})

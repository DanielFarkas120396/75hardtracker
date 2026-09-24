// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import { addDaysISO, todayISO } from '../../lib/dates'
import { loadBadgeEvaluation } from '../badgeEvaluation'
import { db } from '../db'
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

import { todayISO } from '../lib/dates'
import { bookCountsForAttempt, buildBadgeContext, type BadgeContext } from '../logic/badges'
import { loadChallengeDays } from './challengeDays'
import { badgeRepo } from './repositories/badgeRepo'
import { bookRepo } from './repositories/bookRepo'
import type { Book, Challenge } from './types'

/** The local date a book was finished, if known (books finished before this was tracked have none). */
function finishedOn(book: Book): string | undefined {
  if (!book.finished || !book.finishedAt) return undefined
  const finishedAt = new Date(book.finishedAt)
  return Number.isNaN(finishedAt.getTime()) ? undefined : todayISO(finishedAt)
}

export interface BadgeEvaluationInput {
  context: BadgeContext
  unlockedBadgeIds: Set<string>
}

/**
 * Loads everything needed to decide which badges an attempt has earned:
 * its day entries and workouts (one batched query), finished books, and the
 * badges it already has. Read-only — safe to run inside a live query.
 */
export async function loadBadgeEvaluation(challenge: Challenge, todayDayNumber: number): Promise<BadgeEvaluationInput> {
  const days = await loadChallengeDays(challenge.id)
  const books = await bookRepo.getAll()
  const unlocked = await badgeRepo.getForChallenge(challenge.id)

  const context = buildBadgeContext({
    days,
    todayDayNumber,
    booksFinished: books.filter((b) => bookCountsForAttempt(finishedOn(b), challenge.startDate)).length,
  })

  return { context, unlockedBadgeIds: new Set(unlocked.map((b) => b.badgeId)) }
}

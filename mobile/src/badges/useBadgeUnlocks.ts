import { BADGE_DEFINITIONS, bookCountsForAttempt, buildBadgeContext, evaluateNewBadges } from '@logic/badges'
import type { ChallengeGate } from '@logic/challengeGate'
import { todayISO } from '@logic/dates'
import { useEffect } from 'react'
import { badgeRepo } from '../db/repositories/badgeRepo'
import { bookRepo } from '../db/repositories/bookRepo'
import type { Book, Challenge } from '../db/types'
import { useLiveQuery } from '../db/useLiveQuery'
import { loadChallengeDays } from '../endings/stats'
import { queueBadges, setBadgesPaused } from '../toasts/store'

/** The local date a book was finished, if known (books finished before this was tracked have none). */
function finishedOn(book: Book): string | undefined {
  if (!book.finished || !book.finishedAt) return undefined
  const finishedAt = new Date(book.finishedAt)
  return Number.isNaN(finishedAt.getTime()) ? undefined : todayISO(finishedAt)
}

/** What decides an attempt's badges: its days, its finished books, and the badges it has. Read-only. */
async function loadBadgeEvaluation(challenge: Challenge, todayDayNumber: number) {
  const { rules, days } = await loadChallengeDays(challenge.id)
  const books = await bookRepo.getAll()
  const unlocked = await badgeRepo.getForChallenge(challenge.id)
  const context = buildBadgeContext({
    days,
    todayDayNumber,
    booksFinished: books.filter((book) => bookCountsForAttempt(finishedOn(book), challenge.startDate)).length,
    rules,
    restoredDays: challenge.restoredDays,
  })
  return { context, unlockedBadgeIds: new Set(unlocked.map((badge) => badge.badgeId)) }
}

/**
 * Watches the current attempt's data and unlocks every badge it has earned but doesn't have yet, queueing a toast
 * for each one newly unlocked. It runs in the tabs' layout, so badges earned by an attempt's last action (Day 75,
 * as Today turns into Victory) still unlock. Badges wait while `paused` (a covering screen is up). The web's
 * useBadgeUnlocks and the pause in App.tsx.
 */
export function useBadgeUnlocks(gate: ChallengeGate | null | undefined, paused: boolean): void {
  // A failed or given-up attempt isn't evaluated: its day number keeps growing after it ended.
  const challenge = gate && gate.kind !== 'needsRestart' && gate.kind !== 'abandoned' ? gate.challenge : undefined
  const todayDayNumber = gate?.todayDayNumber
  const evaluation = useLiveQuery(
    async () => (challenge && todayDayNumber !== undefined ? loadBadgeEvaluation(challenge, todayDayNumber) : null),
    // The challenge only matters by id and start date (the gate hands a new object each time).
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [challenge?.id, challenge?.startDate, todayDayNumber],
  )

  const challengeId = challenge?.id
  useEffect(() => {
    if (!evaluation || challengeId === undefined) return
    const earned = evaluateNewBadges(evaluation.context, evaluation.unlockedBadgeIds)
    if (earned.length === 0) return
    void badgeRepo.unlockMissing(challengeId, earned).then((added) => queueBadges(BADGE_DEFINITIONS.filter((badge) => added.includes(badge.id))))
  }, [evaluation, challengeId])

  // No "Badge unlocked" over bad news, nor over the peak: the restart, joker and gave-up screens hide the tab bar too.
  const blocking = gate?.kind === 'needsRestart' || gate?.kind === 'jokerUsed' || gate?.kind === 'abandoned'
  const hold = paused || blocking
  useEffect(() => setBadgesPaused(hold), [hold])
}

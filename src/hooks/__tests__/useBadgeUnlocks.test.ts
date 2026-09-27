import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Challenge } from '../../db/types'
import { addDaysISO, todayISO } from '../../lib/dates'
import { useBadgeUnlocks } from '../useBadgeUnlocks'
import type { ChallengeGate } from '../useChallengeGate'

// Stands in for the badge data load, so the test sees whether an attempt gets evaluated at all.
const { loadBadgeEvaluation } = vi.hoisted(() => ({ loadBadgeEvaluation: vi.fn() }))
vi.mock('../../db/badgeEvaluation', () => ({ loadBadgeEvaluation }))

/** A gate on Day 12 of an attempt that is running, or was given up today. */
function gate(kind: 'active' | 'abandoned'): ChallengeGate {
  const today = todayISO()
  const challenge: Challenge = { id: 1, startDate: addDaysISO(today, -11), attemptNumber: 1, status: 'active' }
  const base = { dayEntries: [], today, todayDayNumber: 12, streak: 11, missedDays: [], jokersLeft: 0 }
  return kind === 'active'
    ? { ...base, kind, challenge }
    : { ...base, kind, challenge: { ...challenge, status: 'abandoned', abandonedOn: today } }
}

describe('useBadgeUnlocks', () => {
  beforeEach(() => {
    loadBadgeEvaluation.mockReset()
    loadBadgeEvaluation.mockResolvedValue(undefined)
  })

  it("evaluates the running attempt's badges", async () => {
    renderHook(() => useBadgeUnlocks(gate('active')))
    await waitFor(() => expect(loadBadgeEvaluation).toHaveBeenCalled())
  })

  it('never evaluates a given-up attempt, whose day number keeps growing after it ended', async () => {
    renderHook(() => useBadgeUnlocks(gate('abandoned')))
    // Give the live query time to run, if it's going to.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(loadBadgeEvaluation).not.toHaveBeenCalled()
  })
})

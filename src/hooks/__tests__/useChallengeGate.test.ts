import { describe, expect, it } from 'vitest'
import type { Challenge, DayEntry } from '../../db/types'
import { addDaysISO, todayISO } from '../../lib/dates'
import { resolveGate } from '../useChallengeGate'

const today = todayISO()
const startDate = addDaysISO(today, -5) // the challenge started 5 days ago, so today is Day 6

function challenge(overrides: Partial<Challenge> = {}): Challenge {
  return { id: 1, startDate, attemptNumber: 1, status: 'active', ...overrides }
}

function dayEntry(dayNumber: number, completed: boolean): DayEntry {
  return {
    id: dayNumber,
    challengeId: 1,
    date: addDaysISO(startDate, dayNumber - 1),
    dayNumber,
    water_ml: 0,
    pages_read: 0,
    dietFollowed: false,
    noAlcohol: false,
    completed,
  }
}

// Days 1, 2, 4 and 5 complete; Day 3 has no entry at all (missing).
const oneMissingDay: DayEntry[] = [dayEntry(1, true), dayEntry(2, true), dayEntry(4, true), dayEntry(5, true)]

const everyDayComplete: DayEntry[] = [
  dayEntry(1, true),
  dayEntry(2, true),
  dayEntry(3, true),
  dayEntry(4, true),
  dayEntry(5, true),
]

describe('resolveGate', () => {
  it('announces a joker used on a Medium challenge when the miss has not been acknowledged yet', () => {
    const gate = resolveGate(challenge({ variant: 'medium' }), oneMissingDay, today)
    expect(gate).toMatchObject({ kind: 'jokerUsed', newlyMissed: [3], missedDays: [3], jokersLeft: 0 })
  })

  it('stays active once the miss has been acknowledged', () => {
    const gate = resolveGate(challenge({ variant: 'medium', jokersAcknowledged: 1 }), oneMissingDay, today)
    expect(gate).toMatchObject({ kind: 'active', jokersLeft: 0 })
  })

  it('needs a restart on a Hard challenge with the same days, which has no jokers to spend', () => {
    const gate = resolveGate(challenge(), oneMissingDay, today)
    expect(gate).toMatchObject({ kind: 'needsRestart', failedDayNumber: 3 })
  })

  it('is active with nothing missed when a variant-less challenge has every day complete', () => {
    const gate = resolveGate(challenge(), everyDayComplete, today)
    expect(gate).toMatchObject({ kind: 'active', missedDays: [], jokersLeft: 0 })
  })

  it('lets completion win over an unacknowledged joker once every day but one is done past Day 75', () => {
    // Today is Day 76; every day but Day 10 is complete, and the miss was never acknowledged.
    const longStart = addDaysISO(today, -75)
    const days = Array.from({ length: 75 }, (_, i) => i + 1)
      .filter((n) => n !== 10)
      .map((n) => dayEntry(n, true))

    const gate = resolveGate(challenge({ variant: 'medium', startDate: longStart }), days, today)

    expect(gate).toMatchObject({ kind: 'completed' })
  })

  it('reports only the newly missed day once some misses were already acknowledged', () => {
    // Today is Day 12 of a Soft challenge; Days 3 and 9 are missing, and Day 3's miss is already acknowledged.
    const shortStart = addDaysISO(today, -11)
    const days = [1, 2, 4, 5, 6, 7, 8, 10, 11].map((n) => dayEntry(n, true))

    const gate = resolveGate(challenge({ variant: 'soft', startDate: shortStart, jokersAcknowledged: 1 }), days, today)

    expect(gate).toMatchObject({ kind: 'jokerUsed', newlyMissed: [9], jokersLeft: 1 })
  })

  it('is abandoned for a given-up attempt, even with a day missed beyond its jokers', () => {
    const gate = resolveGate(challenge({ status: 'abandoned', abandonedOn: today }), oneMissingDay, today)
    expect(gate.kind).toBe('abandoned')
  })

  it('never announces a joker on a given-up attempt', () => {
    const gate = resolveGate(
      challenge({ status: 'abandoned', variant: 'medium', abandonedOn: today }),
      oneMissingDay,
      today,
    )
    expect(gate.kind).toBe('abandoned')
  })
})

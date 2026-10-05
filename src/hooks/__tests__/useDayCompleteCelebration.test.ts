import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Challenge, DayEntry } from '../../db/types'
import type { ChallengeGate } from '../useChallengeGate'
import { useDayCompleteCelebration } from '../useDayCompleteCelebration'

const challenge: Challenge = { id: 1, startDate: '2026-09-01', attemptNumber: 1, status: 'active' }

function entry(dayNumber: number, completed: boolean): DayEntry {
  return { id: dayNumber, challengeId: 1, date: '2026-09-01', dayNumber, water_ml: 0, pages_read: 0, dietFollowed: false, noAlcohol: false, completed }
}

/** Day 6, with Days 1–4 done; Day 5 (yesterday) open until noon when `late` is set. */
function gate(day5Done: boolean, day6Done: boolean, late: boolean): ChallengeGate {
  return {
    kind: 'active',
    challenge,
    dayEntries: [1, 2, 3, 4].map((d) => entry(d, true)).concat(entry(5, day5Done), entry(6, day6Done)),
    today: '2026-09-06',
    todayDayNumber: 6,
    streak: 4,
    missedDays: [],
    jokersLeft: 0,
    lateDayNumber: late ? 5 : null,
    lateDayPending: late && !day5Done,
  }
}

describe('useDayCompleteCelebration', () => {
  it('celebrates today when it gets done, not on load', () => {
    const { result, rerender } = renderHook(({ g }) => useDayCompleteCelebration(g), { initialProps: { g: gate(true, false, false) } })
    expect(result.current.celebration).toBeNull()
    rerender({ g: gate(true, true, false) })
    expect(result.current.celebration).toMatchObject({ dayNumber: 6, streak: 6, late: false })
  })

  it('celebrates yesterday when it gets finished in the morning', () => {
    const { result, rerender } = renderHook(({ g }) => useDayCompleteCelebration(g), { initialProps: { g: gate(false, false, true) } })
    rerender({ g: gate(true, false, true) })
    expect(result.current.celebration).toMatchObject({ dayNumber: 5, streak: 5, isFinalDay: false, late: true })
  })

  it('stays quiet when the window closes at noon', () => {
    const { result, rerender } = renderHook(({ g }) => useDayCompleteCelebration(g), { initialProps: { g: gate(true, false, true) } })
    rerender({ g: gate(true, false, false) })
    expect(result.current.celebration).toBeNull()
  })
})

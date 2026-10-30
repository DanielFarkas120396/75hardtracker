import { describe, expect, it } from 'vitest'
import { addDaysISO } from '../../lib/dates'
import { resolveChallengeGate } from '../restart'
import { backupGapDays, withRestoredDays } from '../restoredDays'
import { calculateStreak } from '../streak'

const START = '2026-01-01'
const onDay = (day: number) => addDaysISO(START, day - 1)
const complete = (to: number) => Array.from({ length: to }, (_, i) => ({ dayNumber: i + 1, completed: true }))

describe('backupGapDays', () => {
  const gap = (backupDay: number, today: number, summaries = complete(backupDay)) =>
    backupGapDays({ startDate: START, backupDate: onDay(backupDay), today: onDay(today), summaries })

  it('lists the days after a backup, up to yesterday', () => {
    expect(gap(33, 40)).toEqual([34, 35, 36, 37, 38, 39])
  })

  it('includes the backup day itself when it was unfinished', () => {
    expect(gap(33, 36, complete(32))).toEqual([33, 34, 35])
  })

  it('finds nothing for a backup made today or yesterday with the day done', () => {
    expect(gap(40, 40)).toEqual([])
    expect(gap(39, 40)).toEqual([])
  })

  it('leaves out days missed before the backup was made', () => {
    const earlierMiss = [...complete(9), { dayNumber: 10, completed: false }, ...complete(33).slice(10)]
    expect(gap(33, 36, earlierMiss)).toEqual([34, 35])
  })

  it('stops at Day 75', () => {
    expect(gap(74, 80)).toEqual([75])
  })

  it('finds nothing before the attempt has started', () => {
    expect(backupGapDays({ startDate: START, backupDate: '2025-12-20', today: '2025-12-25', summaries: [] })).toEqual([])
  })
})

describe('withRestoredDays', () => {
  it('keeps a Hard attempt alive and the streak whole', () => {
    const summaries = withRestoredDays(complete(33), [34, 35, 36, 37, 38, 39])
    const gate = resolveChallengeGate({ currentStatus: 'active', dayEntries: summaries, todayDayNumber: 40, jokers: 0 })
    expect(gate.kind).toBe('active')
    expect(calculateStreak(summaries, 40)).toBe(39)
  })

  it('counts a partly logged day as done', () => {
    expect(withRestoredDays([{ dayNumber: 1, completed: false }], [1])).toEqual([{ dayNumber: 1, completed: true }])
  })

  it('changes nothing without restored days', () => {
    expect(withRestoredDays(complete(2))).toEqual(complete(2))
  })
})

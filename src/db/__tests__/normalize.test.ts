import { describe, expect, it } from 'vitest'
import { normalizeRecords } from '../normalize'
import type { Badge, Challenge, DayEntry, Workout } from '../types'

const today = '2026-09-24'

const challenge = (id: number, extra: Partial<Challenge> = {}): Challenge => ({
  id,
  startDate: '2026-09-20',
  attemptNumber: id,
  status: 'failed',
  ...extra,
})

const day = (id: number, dayNumber: number, extra: Partial<DayEntry> = {}): DayEntry => ({
  id,
  challengeId: 1,
  date: `2026-09-${19 + dayNumber}`,
  dayNumber,
  water_ml: 0,
  pages_read: 0,
  dietFollowed: false,
  noAlcohol: false,
  completed: false,
  ...extra,
})

const badge = (id: number, badgeId: string, unlockedAt: string, challengeId = 1): Badge => ({
  id,
  badgeId,
  challengeId,
  unlockedAt,
})

describe('normalizeRecords', () => {
  it('returns clean data unchanged, with an all-zero report', () => {
    const records = {
      challenges: [challenge(1, { status: 'active' })],
      dayEntries: [day(1, 1), day(2, 2)],
      workouts: [] as Workout[],
      badges: [badge(1, 'first-photo', '2026-09-20T10:00:00Z')],
    }
    const result = normalizeRecords(records, today)
    expect(result.challenges).toEqual(records.challenges)
    expect(result.dayEntries).toEqual(records.dayEntries)
    expect(result.badges).toEqual(records.badges)
    expect(Object.values(result.report).every((n) => n === 0)).toBe(true)
  })

  it('merges duplicate days into the oldest entry, keeping the most of every field and all workouts', () => {
    const result = normalizeRecords(
      {
        challenges: [challenge(1, { status: 'active' })],
        dayEntries: [
          day(5, 1, { water_ml: 1000, notes: 'Legs day' }),
          day(9, 1, { water_ml: 400, pages_read: 12, mood: 4, notes: 'Felt strong' }),
        ],
        workouts: [{ id: 1, dayEntryId: 9, type: 'Running', durationMin: 45, isOutdoor: true }],
        badges: [],
      },
      today,
    )
    expect(result.dayEntries).toEqual([
      expect.objectContaining({ id: 5, water_ml: 1000, pages_read: 12, mood: 4, notes: 'Legs day\n\nFelt strong' }),
    ])
    expect(result.workouts).toEqual([expect.objectContaining({ id: 1, dayEntryId: 5 })])
    expect(result.report.duplicateDayEntriesMerged).toBe(1)
  })

  it('keeps the earliest copy of a duplicated badge, per attempt', () => {
    const result = normalizeRecords(
      {
        challenges: [challenge(1), challenge(2, { status: 'active' })],
        dayEntries: [],
        workouts: [],
        badges: [
          badge(1, 'streak-7', '2026-09-27T20:00:00Z'),
          badge(2, 'streak-7', '2026-09-27T19:00:00Z'),
          badge(3, 'streak-7', '2026-10-10T19:00:00Z', 2),
        ],
      },
      today,
    )
    expect(result.badges.map((b) => b.id)).toEqual([2, 3])
    expect(result.report.duplicateBadgesRemoved).toBe(1)
  })

  it('archives all but the latest of several active attempts', () => {
    const result = normalizeRecords(
      {
        challenges: [challenge(1, { status: 'active' }), challenge(2, { status: 'active' })],
        dayEntries: [],
        workouts: [],
        badges: [],
      },
      today,
    )
    expect(result.challenges.map((c) => c.status)).toEqual(['failed', 'active'])
  })

  it('renumbers colliding attempt numbers in their existing order', () => {
    const result = normalizeRecords(
      {
        challenges: [
          challenge(1, { attemptNumber: 1, status: 'completed' }),
          challenge(2, { attemptNumber: 1, status: 'active' }),
        ],
        dayEntries: [],
        workouts: [],
        badges: [],
      },
      today,
    )
    expect(result.challenges.map((c) => c.attemptNumber)).toEqual([1, 2])
  })

  it('repairs an empty start date from the earliest entry, or today', () => {
    const result = normalizeRecords(
      {
        challenges: [challenge(1, { startDate: '' }), challenge(2, { startDate: 'not a date', status: 'active' })],
        dayEntries: [day(1, 3, { date: '2026-09-22' }), day(2, 1, { date: '2026-09-20' })],
        workouts: [],
        badges: [],
      },
      today,
    )
    expect(result.challenges.map((c) => c.startDate)).toEqual(['2026-09-20', today])
  })

  it('recomputes a broken day number from the date', () => {
    const broken = { ...day(1, 1), dayNumber: null as unknown as number, date: '2026-09-22' }
    const result = normalizeRecords(
      { challenges: [challenge(1, { status: 'active' })], dayEntries: [broken], workouts: [], badges: [] },
      today,
    )
    expect(result.dayEntries[0].dayNumber).toBe(3)
  })
})

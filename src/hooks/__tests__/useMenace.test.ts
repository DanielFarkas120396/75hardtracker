import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { freshDatabase } from '../../db/__tests__/fixtures'
import { SETTING_KEYS, settingsRepo } from '../../db/repositories/settingsRepo'
import type { DayEntry } from '../../db/types'
import { MIN_WORKOUT_MIN } from '../../logic/constants'
import type { DayTaskData } from '../../logic/types'
import { useMenace } from '../useMenace'

/**
 * Day 3 of seedMenaceDay: the workouts done, 2.1 L of water, and the
 * reading, photo and diet still to do — 102 + 20 + 2 + 2 = 126 minutes
 * needed. At 19:00 that's `watching` against a 23:00 bedtime (slack 114)
 * but `tapping` against a 22:00 bedtime (slack 54).
 */
const DATA: DayTaskData = {
  water_ml: 2100,
  pages_read: 0,
  dietFollowed: false,
  noAlcohol: false,
  hasPhoto: false,
  workouts: [
    { durationMin: MIN_WORKOUT_MIN, isOutdoor: true },
    { durationMin: 60, isOutdoor: false },
  ],
}

const ENTRY: DayEntry = {
  id: 1,
  challengeId: 1,
  date: '2026-09-25',
  dayNumber: 3,
  water_ml: 2100,
  pages_read: 0,
  dietFollowed: false,
  noAlcohol: false,
  completed: false,
}

describe('useMenace', () => {
  beforeEach(freshDatabase)

  it("never computes a result against the default bedtime while the saved one is still loading", async () => {
    await settingsRepo.set(SETTING_KEYS.bedtime, '22:00')

    const results: ReturnType<typeof useMenace>[] = []
    renderHook(() => {
      const result = useMenace(DATA, ENTRY, 19 * 60)
      results.push(result)
      return result
    })

    await waitFor(() => expect(results.some((result) => result !== undefined)).toBe(true))

    for (const result of results) {
      if (result !== undefined) expect(result.level).toBe('tapping')
    }
  })
})

import { describe, expect, it } from 'vitest'
import { hasAnyProgress, isDayComplete, missingTasks, taskCompletionMap } from '../dayCompletion'
import type { DayTaskData } from '../types'

function perfectDay(): DayTaskData {
  return {
    water_ml: 3800,
    pages_read: 10,
    dietFollowed: true,
    noAlcohol: true,
    hasPhoto: true,
    workouts: [
      { durationMin: 45, isOutdoor: true },
      { durationMin: 60, isOutdoor: false },
    ],
  }
}

describe('isDayComplete', () => {
  it('is true when all five tasks are satisfied', () => {
    expect(isDayComplete(perfectDay())).toBe(true)
  })

  it('is false when water is short of the 3.8L target', () => {
    expect(isDayComplete({ ...perfectDay(), water_ml: 3799 })).toBe(false)
  })

  it('is false when fewer than 10 pages were read', () => {
    expect(isDayComplete({ ...perfectDay(), pages_read: 9 })).toBe(false)
  })

  it('is false when a cheat meal broke the diet', () => {
    expect(isDayComplete({ ...perfectDay(), dietFollowed: false })).toBe(false)
  })

  it('is false when alcohol was consumed', () => {
    expect(isDayComplete({ ...perfectDay(), noAlcohol: false })).toBe(false)
  })

  it('is false when no photo was taken', () => {
    expect(isDayComplete({ ...perfectDay(), hasPhoto: false })).toBe(false)
  })

  it('is false with only one qualifying workout', () => {
    expect(isDayComplete({ ...perfectDay(), workouts: [{ durationMin: 45, isOutdoor: true }] })).toBe(false)
  })

  it('is false when neither workout is outdoor', () => {
    expect(
      isDayComplete({
        ...perfectDay(),
        workouts: [
          { durationMin: 45, isOutdoor: false },
          { durationMin: 60, isOutdoor: false },
        ],
      }),
    ).toBe(false)
  })

  it('is false when a workout is under the 45 minute minimum', () => {
    expect(
      isDayComplete({
        ...perfectDay(),
        workouts: [
          { durationMin: 44, isOutdoor: true },
          { durationMin: 60, isOutdoor: false },
        ],
      }),
    ).toBe(false)
  })

  it('counts extra qualifying workouts beyond two', () => {
    expect(
      isDayComplete({
        ...perfectDay(),
        workouts: [
          { durationMin: 45, isOutdoor: false },
          { durationMin: 45, isOutdoor: false },
          { durationMin: 45, isOutdoor: true },
        ],
      }),
    ).toBe(true)
  })
})

describe('missingTasks', () => {
  it('is empty for a perfect day', () => {
    expect(missingTasks(perfectDay())).toEqual([])
  })

  it('lists every unmet task in fixed order', () => {
    const data: DayTaskData = {
      water_ml: 0,
      pages_read: 0,
      dietFollowed: false,
      noAlcohol: false,
      hasPhoto: false,
      workouts: [],
    }
    expect(missingTasks(data)).toEqual(['workouts', 'diet', 'water', 'reading', 'photo'])
  })

  it('lists only the tasks that are unmet', () => {
    expect(missingTasks({ ...perfectDay(), water_ml: 0, hasPhoto: false })).toEqual(['water', 'photo'])
  })
})

describe('taskCompletionMap', () => {
  it('reports each task independently', () => {
    expect(taskCompletionMap(perfectDay())).toEqual({
      workouts: true,
      diet: true,
      water: true,
      reading: true,
      photo: true,
    })
  })
})

describe('hasAnyProgress', () => {
  const nothing: DayTaskData = {
    water_ml: 0,
    pages_read: 0,
    dietFollowed: false,
    noAlcohol: false,
    hasPhoto: false,
    workouts: [],
  }

  it('is false for an untouched day', () => {
    expect(hasAnyProgress(nothing)).toBe(false)
  })

  it('is true as soon as any single thing is logged', () => {
    expect(hasAnyProgress({ ...nothing, water_ml: 250 })).toBe(true)
    expect(hasAnyProgress({ ...nothing, pages_read: 1 })).toBe(true)
    expect(hasAnyProgress({ ...nothing, dietFollowed: true })).toBe(true)
    expect(hasAnyProgress({ ...nothing, noAlcohol: true })).toBe(true)
    expect(hasAnyProgress({ ...nothing, hasPhoto: true })).toBe(true)
    expect(hasAnyProgress({ ...nothing, workouts: [{ durationMin: 0, isOutdoor: false }] })).toBe(true)
  })
})

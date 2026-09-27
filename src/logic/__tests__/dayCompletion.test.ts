import { describe, expect, it } from 'vitest'
import {
  hasAnyProgress,
  isDayComplete,
  isDietTaskComplete,
  isWaterTaskComplete,
  isWorkoutsTaskComplete,
  missingTasks,
  taskCompletionMap,
} from '../dayCompletion'
import { RULESETS } from '../rulesets'
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
    expect(isDayComplete(perfectDay(), RULESETS.hard)).toBe(true)
  })

  it('is false when water is short of the 3.8L target', () => {
    expect(isDayComplete({ ...perfectDay(), water_ml: 3799 }, RULESETS.hard)).toBe(false)
  })

  it('is false when fewer than 10 pages were read', () => {
    expect(isDayComplete({ ...perfectDay(), pages_read: 9 }, RULESETS.hard)).toBe(false)
  })

  it('is false when a cheat meal broke the diet', () => {
    expect(isDayComplete({ ...perfectDay(), dietFollowed: false }, RULESETS.hard)).toBe(false)
  })

  it('is false when alcohol was consumed', () => {
    expect(isDayComplete({ ...perfectDay(), noAlcohol: false }, RULESETS.hard)).toBe(false)
  })

  it('is false when no photo was taken', () => {
    expect(isDayComplete({ ...perfectDay(), hasPhoto: false }, RULESETS.hard)).toBe(false)
  })

  it('is false with only one qualifying workout', () => {
    expect(isDayComplete({ ...perfectDay(), workouts: [{ durationMin: 45, isOutdoor: true }] }, RULESETS.hard)).toBe(false)
  })

  it('is false when neither workout is outdoor', () => {
    expect(
      isDayComplete(
        {
          ...perfectDay(),
          workouts: [
            { durationMin: 45, isOutdoor: false },
            { durationMin: 60, isOutdoor: false },
          ],
        },
        RULESETS.hard,
      ),
    ).toBe(false)
  })

  it('is false when a workout is under the 45 minute minimum', () => {
    expect(
      isDayComplete(
        {
          ...perfectDay(),
          workouts: [
            { durationMin: 44, isOutdoor: true },
            { durationMin: 60, isOutdoor: false },
          ],
        },
        RULESETS.hard,
      ),
    ).toBe(false)
  })

  it('counts extra qualifying workouts beyond two', () => {
    expect(
      isDayComplete(
        {
          ...perfectDay(),
          workouts: [
            { durationMin: 45, isOutdoor: false },
            { durationMin: 45, isOutdoor: false },
            { durationMin: 45, isOutdoor: true },
          ],
        },
        RULESETS.hard,
      ),
    ).toBe(true)
  })
})

describe('missingTasks', () => {
  it('is empty for a perfect day', () => {
    expect(missingTasks(perfectDay(), RULESETS.hard)).toEqual([])
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
    expect(missingTasks(data, RULESETS.hard)).toEqual(['workouts', 'diet', 'water', 'reading', 'photo'])
  })

  it('lists only the tasks that are unmet', () => {
    expect(missingTasks({ ...perfectDay(), water_ml: 0, hasPhoto: false }, RULESETS.hard)).toEqual(['water', 'photo'])
  })
})

describe('taskCompletionMap', () => {
  it('reports each task independently', () => {
    expect(taskCompletionMap(perfectDay(), RULESETS.hard)).toEqual({
      workouts: true,
      diet: true,
      water: true,
      reading: true,
      photo: true,
    })
  })
})

describe('completion under 75 Medium rules', () => {
  const medium = RULESETS.medium
  const base = { water_ml: 3000, pages_read: 10, dietFollowed: true, noAlcohol: true, hasPhoto: true }

  it('counts one indoor 45-minute workout', () => {
    const data = { ...base, workouts: [{ durationMin: 45, isOutdoor: false }] }
    expect(isWorkoutsTaskComplete(data, medium)).toBe(true)
    expect(isWorkoutsTaskComplete(data, RULESETS.hard)).toBe(false)
  })

  it('completes the water at 3 L', () => {
    const data = { ...base, workouts: [] }
    expect(isWaterTaskComplete(data, medium)).toBe(true)
    expect(isWaterTaskComplete(data, RULESETS.hard)).toBe(false)
  })

  it('completes a whole day on Medium targets', () => {
    const data = { ...base, workouts: [{ durationMin: 45, isOutdoor: false }] }
    expect(isDayComplete(data, medium)).toBe(true)
    expect(missingTasks(data, RULESETS.hard)).toEqual(['workouts', 'water'])
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

describe('recovery days and social occasions', () => {
  const day = {
    water_ml: 3800,
    pages_read: 10,
    dietFollowed: true,
    noAlcohol: true,
    hasPhoto: true,
    workouts: [] as { durationMin: number; isOutdoor: boolean }[],
  }

  it('counts a recovery day as the workouts on 75 Soft only', () => {
    expect(isWorkoutsTaskComplete({ ...day, restDay: true }, RULESETS.soft)).toBe(true)
    expect(isWorkoutsTaskComplete({ ...day, restDay: true }, RULESETS.medium)).toBe(false)
    expect(isWorkoutsTaskComplete({ ...day, restDay: true }, RULESETS.hard)).toBe(false)
  })

  it('allows a drink on a declared social occasion, except on 75 Hard', () => {
    const drank = { ...day, noAlcohol: false, socialDay: true }
    expect(isDietTaskComplete(drank, RULESETS.strong)).toBe(true)
    expect(isDietTaskComplete(drank, RULESETS.medium)).toBe(true)
    expect(isDietTaskComplete(drank, RULESETS.soft)).toBe(true)
    expect(isDietTaskComplete(drank, RULESETS.hard)).toBe(false)
  })

  it('still needs the diet itself on a social occasion', () => {
    expect(isDietTaskComplete({ ...day, dietFollowed: false, noAlcohol: false, socialDay: true }, RULESETS.strong)).toBe(false)
  })

  it('needs no alcohol on an ordinary day', () => {
    expect(isDietTaskComplete({ ...day, noAlcohol: false }, RULESETS.strong)).toBe(false)
  })
})

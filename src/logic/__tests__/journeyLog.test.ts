import { describe, expect, it } from 'vitest'
import { journeyLog as sharedJourneyLog, type LogInput } from '../journeyLog'
import { WORLD_SPANS } from '../worlds'

const journeyLog = (input: LogInput) => sharedJourneyLog(WORLD_SPANS, input)

const range = (from: number, to: number) => new Set(Array.from({ length: to - from + 1 }, (_, i) => from + i))
const none = new Set<number>()

describe('journeyLog', () => {
  it('opens on the current world, newest day first, with the next world locked above it', () => {
    const log = journeyLog({ todayDayNumber: 46, completed: false, completedDays: range(1, 45), missedDays: none, restoredDays: none })

    expect(log.next).toEqual({ world: expect.objectContaining({ id: 'mountains' }), inDays: 5 })
    expect(log.chapters.map((c) => c.world.id)).toEqual(['meadow', 'forest', 'wasteland', 'hell'])
    const [meadow, forest] = log.chapters
    expect(meadow.cleared).toBe(false)
    expect(meadow.days.map((d) => d.dayNumber)).toEqual([46, 45, 44, 43, 42, 41, 40, 39, 38])
    expect(meadow.days[0].status).toBe('today')
    expect(meadow.done).toBe(8)
    expect(forest.cleared).toBe(true)
    expect(forest.done).toBe(15)
  })

  it('counts jokers, kept backup days and days not finished', () => {
    const log = journeyLog({
      todayDayNumber: 12,
      completed: false,
      completedDays: new Set([1, 2, 3, 4, 6, 7, 8, 9, 10]),
      missedDays: new Set([5]),
      restoredDays: new Set([2]),
    })
    const hell = log.chapters[1]
    expect(hell.jokers).toBe(1)
    expect(hell.done).toBe(9)
    expect(hell.days.find((d) => d.dayNumber === 5)?.status).toBe('joker')
    expect(hell.days.find((d) => d.dayNumber === 2)?.status).toBe('restored')
    expect(log.chapters[0].days.find((d) => d.dayNumber === 11)?.status).toBe('open')
  })

  it('counts today once it is done', () => {
    const log = journeyLog({ todayDayNumber: 3, completed: false, completedDays: range(1, 3), missedDays: none, restoredDays: none })
    expect(log.chapters[0].done).toBe(3)
  })

  it('shows only Hell waiting before Day 1', () => {
    const log = journeyLog({ todayDayNumber: -1, completed: false, completedDays: none, missedDays: none, restoredDays: none })
    expect(log.chapters).toEqual([])
    expect(log.next).toEqual({ world: expect.objectContaining({ id: 'hell' }), inDays: 2 })
  })

  it('clears every world once all 75 days are done, with nothing ahead', () => {
    const log = journeyLog({ todayDayNumber: 77, completed: true, completedDays: range(1, 75), missedDays: none, restoredDays: none })
    expect(log.next).toBeNull()
    expect(log.chapters[0].world.id).toBe('heaven')
    expect(log.chapters.every((c) => c.cleared)).toBe(true)
    expect(log.chapters[0].days[0]).toEqual({ dayNumber: 75, status: 'done' })
  })
})

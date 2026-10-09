import { describe, expect, it } from 'vitest'
import { RULESETS } from '../../logic/rulesets'
import type { DayTaskData } from '../../logic/types'
import { countedData, notesStatusLine, taskFill, taskProgress, taskStatusLine } from '../taskStatus'

const empty: DayTaskData = { water_ml: 0, pages_read: 0, dietFollowed: false, noAlcohol: false, hasPhoto: false, workouts: [] }
const hard = RULESETS.hard
const medium = RULESETS.medium
const strong = RULESETS.strong
const soft = RULESETS.soft

describe('taskStatusLine', () => {
  it('workouts: the target while nothing is logged, then the count, then the summary', () => {
    expect(taskStatusLine('workouts', empty, hard, false)).toBe('0 of 2 · 45 min each')
    expect(taskStatusLine('workouts', empty, medium, false)).toBe('0 of 1 · 45 min')
    const one = { ...empty, workouts: [{ durationMin: 45, isOutdoor: false }] }
    expect(taskStatusLine('workouts', one, hard, false)).toBe('1 of 2 logged')
    // A 20-minute session is logged but doesn't count.
    expect(taskStatusLine('workouts', { ...empty, workouts: [{ durationMin: 20, isOutdoor: false }] }, hard, false)).toBe(
      '0 of 2 · 45 min each',
    )
    const two = { ...empty, workouts: [{ durationMin: 45, isOutdoor: true }, { durationMin: 50, isOutdoor: false }] }
    expect(taskStatusLine('workouts', two, hard, true)).toBe('2 workouts · 95 min')
    expect(taskStatusLine('workouts', one, medium, true)).toBe('1 workout · 45 min')
    expect(taskStatusLine('workouts', { ...empty, restDay: true }, soft, true)).toBe('Recovery day')
  })

  it('diet: two things to tick, one on a social day', () => {
    expect(taskStatusLine('diet', empty, hard, false)).toBe('2 to tick')
    expect(taskStatusLine('diet', { ...empty, dietFollowed: true }, hard, false)).toBe('1 of 2')
    expect(taskStatusLine('diet', { ...empty, dietFollowed: true, noAlcohol: true }, hard, true)).toBe('Followed')
    const social = { ...empty, socialDay: true }
    expect(taskStatusLine('diet', social, strong, false)).toBe('1 to tick')
    expect(taskStatusLine('diet', { ...social, dietFollowed: true }, strong, true)).toBe('Followed')
    // Hard has no social days: a stray flag changes nothing.
    expect(taskStatusLine('diet', social, hard, false)).toBe('2 to tick')
  })

  it('water: litres against the target, then just the litres', () => {
    expect(taskStatusLine('water', empty, hard, false)).toBe('0 / 3.8 L')
    expect(taskStatusLine('water', { ...empty, water_ml: 1250 }, medium, false)).toBe('1.25 / 3 L')
    expect(taskStatusLine('water', { ...empty, water_ml: 3800 }, hard, true)).toBe('3.8 L')
  })

  it('reading: pages against the target, then pages and the book', () => {
    expect(taskStatusLine('reading', { ...empty, pages_read: 4 }, hard, false)).toBe('4 of 10 pages')
    expect(taskStatusLine('reading', { ...empty, pages_read: 12 }, hard, true, 'Atomic Habits')).toBe('12 pages · Atomic Habits')
    expect(taskStatusLine('reading', { ...empty, pages_read: 10 }, hard, true)).toBe('10 pages')
  })

  it('photo', () => {
    expect(taskStatusLine('photo', empty, hard, false)).toBe('No photo yet')
    expect(taskStatusLine('photo', { ...empty, hasPhoto: true }, hard, true)).toBe('Taken')
  })
})

describe('notesStatusLine', () => {
  it('shows the mood, else whether notes exist', () => {
    expect(notesStatusLine({})).toBe('How was today?')
    expect(notesStatusLine({ notes: 'Tough one.' })).toBe('Notes saved')
    expect(notesStatusLine({ mood: 4, notes: 'Tough one.' })).toBe('🙂 Good')
  })
})

describe('taskProgress', () => {
  it('measures workouts, water and reading, capped at 1; nothing for diet and photo', () => {
    expect(taskProgress('water', { ...empty, water_ml: 1900 }, hard)).toBe(0.5)
    expect(taskProgress('water', { ...empty, water_ml: 5000 }, hard)).toBe(1)
    expect(taskProgress('reading', { ...empty, pages_read: 5 }, hard)).toBe(0.5)
    expect(taskProgress('workouts', { ...empty, workouts: [{ durationMin: 45, isOutdoor: false }] }, hard)).toBe(0.5)
    expect(taskProgress('workouts', { ...empty, restDay: true }, soft)).toBe(1)
    expect(taskProgress('diet', empty, hard)).toBeNull()
    expect(taskProgress('photo', empty, hard)).toBeNull()
  })
})

describe('taskFill', () => {
  it('fills the diet half per switch, and whole with the one switch of a social day', () => {
    expect(taskFill('diet', empty, hard)).toBe(0)
    expect(taskFill('diet', { ...empty, dietFollowed: true }, hard)).toBe(0.5)
    expect(taskFill('diet', { ...empty, dietFollowed: true, noAlcohol: true }, hard)).toBe(1)
    const social = { ...empty, socialDay: true }
    expect(taskFill('diet', { ...social, dietFollowed: true }, strong)).toBe(1)
    // Hard has no social days: a stray flag changes nothing.
    expect(taskFill('diet', { ...social, dietFollowed: true }, hard)).toBe(0.5)
  })

  it('fills the photo all at once', () => {
    expect(taskFill('photo', empty, hard)).toBe(0)
    expect(taskFill('photo', { ...empty, hasPhoto: true }, hard)).toBe(1)
  })

  it('follows the measurable tasks like the progress bar, capped at 1', () => {
    expect(taskFill('water', { ...empty, water_ml: 1900 }, hard)).toBe(0.5)
    expect(taskFill('water', { ...empty, water_ml: 5000 }, hard)).toBe(1)
    // Medium and Soft drink 3 L.
    expect(taskFill('water', { ...empty, water_ml: 1500 }, medium)).toBe(0.5)
    expect(taskFill('water', { ...empty, water_ml: 3000 }, soft)).toBe(1)
    expect(taskFill('reading', { ...empty, pages_read: 4 }, hard)).toBe(0.4)
    const one = { ...empty, workouts: [{ durationMin: 45, isOutdoor: false }] }
    expect(taskFill('workouts', one, hard)).toBe(0.5)
    // Medium and Soft need one workout: the same session fills their tile.
    expect(taskFill('workouts', one, medium)).toBe(1)
    expect(taskFill('workouts', one, soft)).toBe(1)
  })
})

describe('countedData', () => {
  it('counts water to the nearest 50 ml and pages one by one, leaving the rest as it is', () => {
    expect(countedData('water', empty, hard, 0.4).water_ml).toBe(1500)
    // 3 L counts in the same 50 ml steps: 0.41 of it is 1230 ml, shown as 1250.
    expect(countedData('water', empty, soft, 0.41).water_ml).toBe(1250)
    expect(countedData('reading', empty, hard, 0.36).pages_read).toBe(4)
    const day = { ...empty, water_ml: 1000 }
    expect(countedData('diet', day, hard, 0.5)).toBe(day)
  })
})

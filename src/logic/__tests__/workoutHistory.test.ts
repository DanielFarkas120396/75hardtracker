import { describe, expect, it } from 'vitest'
import { WORKOUT_TYPES } from '../constants'
import { workoutHistory, type WorkoutSession } from '../workoutHistory'

let nextId = 1
function session(dayNumber: number, type: WorkoutSession['type'], extra: Partial<WorkoutSession> = {}): WorkoutSession {
  return { id: nextId++, dayNumber, date: '2026-10-05', type, durationMin: 45, isOutdoor: false, ...extra }
}

describe('workoutHistory', () => {
  it('groups the sessions by activity, most practised first, ties in the app’s order', () => {
    const history = workoutHistory([
      session(1, 'Cycling'),
      session(1, 'Running'),
      session(2, 'Yoga'),
      session(2, 'Running'),
      session(3, 'Weights'),
    ])

    expect(history.activities.map((a) => [a.type, a.sessions.length])).toEqual([
      ['Running', 2],
      ['Weights', 1],
      ['Yoga', 1],
      ['Cycling', 1],
    ])
    expect(history.untried).toEqual(['Walking', 'Swimming', 'Other'])
  })

  it('lists an activity’s sessions newest first, the later-logged first on the same day', () => {
    const day1 = session(1, 'Running')
    const day3First = session(3, 'Running')
    const day3Second = session(3, 'Running')
    const day2 = session(2, 'Running')

    const [running] = workoutHistory([day1, day3First, day3Second, day2]).activities

    expect(running.sessions).toEqual([day3Second, day3First, day2, day1])
  })

  it('adds up the minutes and the outdoor sessions, overall and per activity', () => {
    const history = workoutHistory([
      session(1, 'Running', { durationMin: 45, isOutdoor: true }),
      session(2, 'Running', { durationMin: 50, isOutdoor: true }),
      session(2, 'Weights', { durationMin: 60 }),
    ])

    expect([history.sessions, history.minutes, history.outdoors]).toEqual([3, 155, 2])
    expect(history.activities.map((a) => [a.type, a.minutes, a.outdoors])).toEqual([
      ['Running', 95, 2],
      ['Weights', 60, 0],
    ])
  })

  it('counts the feels given, best first, leaving out the ones never given', () => {
    const [running] = workoutHistory([
      session(1, 'Running', { feel: 4 }),
      session(2, 'Running', { feel: 2 }),
      session(3, 'Running', { feel: 4 }),
      session(4, 'Running'),
    ]).activities

    expect(running.feels).toEqual([
      { feel: 4, count: 2 },
      { feel: 2, count: 1 },
    ])
  })

  it('with no sessions, has no activities and every activity untried', () => {
    expect(workoutHistory([])).toEqual({ sessions: 0, minutes: 0, outdoors: 0, activities: [], untried: [...WORKOUT_TYPES] })
  })
})

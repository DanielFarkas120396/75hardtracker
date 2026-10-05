import { WORKOUT_TYPES } from './constants'
import type { WorkoutType } from './types'

/** How a session felt, on the five moods of "How was today?" (1 Rough … 5 Great). */
export type Feel = 1 | 2 | 3 | 4 | 5

/** One logged workout, with the day it belongs to. */
export interface WorkoutSession {
  id: number
  dayNumber: number
  /** Its day's ISO date. */
  date: string
  type: WorkoutType
  durationMin: number
  isOutdoor: boolean
  feel?: Feel
}

/** Everything done in one activity. */
export interface ActivityHistory {
  type: WorkoutType
  /** Newest first: by day, then the later-logged first. */
  sessions: WorkoutSession[]
  minutes: number
  outdoors: number
  /** How the sessions felt, best first; only the feels given at least once. */
  feels: { feel: Feel; count: number }[]
}

/** An attempt's workouts, as the Workouts page shows them. */
export interface WorkoutHistory {
  sessions: number
  minutes: number
  outdoors: number
  /** The activities practised, most sessions first; ties keep WORKOUT_TYPES' order. */
  activities: ActivityHistory[]
  /** The activities never practised, in WORKOUT_TYPES' order. */
  untried: WorkoutType[]
}

const FEELS_BEST_FIRST: readonly Feel[] = [5, 4, 3, 2, 1]

const totalMinutes = (sessions: readonly WorkoutSession[]) => sessions.reduce((sum, s) => sum + s.durationMin, 0)
const outdoorCount = (sessions: readonly WorkoutSession[]) => sessions.filter((s) => s.isOutdoor).length

/** Groups an attempt's sessions by activity. */
export function workoutHistory(sessions: readonly WorkoutSession[]): WorkoutHistory {
  const activities = WORKOUT_TYPES.map((type) => activityHistory(type, sessions.filter((s) => s.type === type)))
    .filter((activity) => activity.sessions.length > 0)
    // sort is stable, so equal counts keep WORKOUT_TYPES' order.
    .sort((a, b) => b.sessions.length - a.sessions.length)

  return {
    sessions: sessions.length,
    minutes: totalMinutes(sessions),
    outdoors: outdoorCount(sessions),
    activities,
    untried: WORKOUT_TYPES.filter((type) => !activities.some((activity) => activity.type === type)),
  }
}

function activityHistory(type: WorkoutType, sessions: WorkoutSession[]): ActivityHistory {
  return {
    type,
    sessions: [...sessions].sort((a, b) => b.dayNumber - a.dayNumber || b.id - a.id),
    minutes: totalMinutes(sessions),
    outdoors: outdoorCount(sessions),
    feels: FEELS_BEST_FIRST.map((feel) => ({ feel, count: sessions.filter((s) => s.feel === feel).length })).filter(
      (f) => f.count > 0,
    ),
  }
}

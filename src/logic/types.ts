/**
 * Plain data types the logic module operates on. Deliberately decoupled from
 * src/db/types.ts (Dexie row shapes) so this module never depends on Dexie.
 */

import type { WORKOUT_TYPES } from './constants'

export type TaskId = 'workouts' | 'diet' | 'water' | 'reading' | 'photo'

/** What a workout was; the names double as the English labels. */
export type WorkoutType = (typeof WORKOUT_TYPES)[number]

/** The five moods of "How was today?", 1 Rough … 5 Great. A workout's feel uses them too. */
export type Mood = 1 | 2 | 3 | 4 | 5

export interface WorkoutTaskData {
  durationMin: number
  isOutdoor: boolean
}

export interface DayTaskData {
  water_ml: number
  pages_read: number
  dietFollowed: boolean
  noAlcohol: boolean
  hasPhoto: boolean
  workouts: WorkoutTaskData[]
  /** The attempt's recovery day for its week (75 Soft). */
  restDay?: boolean
  /** A social occasion declared ahead: a drink doesn't break the diet. */
  socialDay?: boolean
}

/** One logged day of an attempt, for whole-attempt calculations (stats, attempt summaries). */
export interface ChallengeDayData {
  dayNumber: number
  data: DayTaskData
}

export type ChallengeStatus = 'active' | 'failed' | 'completed' | 'abandoned'

export interface DayCompletionSummary {
  dayNumber: number
  completed: boolean
}

/**
 * Plain data types the logic module operates on. Deliberately decoupled from
 * src/db/types.ts (Dexie row shapes) so this module never depends on Dexie.
 */

export type TaskId = 'workouts' | 'diet' | 'water' | 'reading' | 'photo'

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
}

/** One logged day of an attempt, for whole-attempt calculations (XP, attempt summaries). */
export interface ChallengeDayData {
  dayNumber: number
  data: DayTaskData
}

export type ChallengeStatus = 'active' | 'failed' | 'completed'

export interface DayCompletionSummary {
  dayNumber: number
  completed: boolean
}

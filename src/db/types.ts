import type { TaskId } from '../logic/types'

export type ChallengeStatus = 'active' | 'failed' | 'completed'

export interface Challenge {
  id: number
  startDate: string // ISO date (yyyy-MM-dd), local
  attemptNumber: number
  status: ChallengeStatus
}

export interface DayEntry {
  id: number
  challengeId: number
  date: string // ISO date (yyyy-MM-dd), local
  dayNumber: number // 1-75
  water_ml: number
  pages_read: number
  dietFollowed: boolean
  noAlcohol: boolean
  photoId?: number
  notes?: string
  mood?: 1 | 2 | 3 | 4 | 5
  /** Today's plan: when each task will be done, as local "HH:mm". Read by the Today duck only. */
  plans?: Partial<Record<TaskId, string>>
  completed: boolean
}

export type WorkoutType =
  | 'Running'
  | 'Walking'
  | 'Weights'
  | 'Yoga'
  | 'Cycling'
  | 'Swimming'
  | 'Other'

export interface Workout {
  id: number
  dayEntryId: number
  type: WorkoutType
  durationMin: number
  isOutdoor: boolean
}

export interface Book {
  id: number
  title: string
  totalPages: number
  currentPage: number
  finished: boolean
  /** ISO datetime the book was finished; unset while unfinished (and for books finished before this was tracked). */
  finishedAt?: string
}

export interface Measurement {
  id: number
  date: string // ISO date
  weight_kg?: number
  bodyMeasurements_cm?: Record<string, number>
}

export interface Photo {
  id: number
  date: string // ISO date
  blob: Blob
}

export interface Badge {
  id: number
  badgeId: string // references a BADGE_DEFINITIONS key in src/logic/badges.ts
  challengeId: number
  unlockedAt: string // ISO datetime
}

export interface SettingsRow {
  key: string
  value: unknown
}

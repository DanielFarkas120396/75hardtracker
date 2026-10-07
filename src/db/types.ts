import type { ChallengeVariant } from '../logic/rulesets'
import type { Mood, TaskId, WorkoutType } from '../logic/types'

export type { WorkoutType }

export type ChallengeStatus = 'active' | 'failed' | 'completed' | 'abandoned'

export interface Challenge {
  id: number
  startDate: string // ISO date (yyyy-MM-dd), local
  attemptNumber: number
  status: ChallengeStatus
  /** Which challenge this attempt is. Missing means 75 Hard (attempts made before variants existed). */
  variant?: ChallengeVariant
  /** Day numbers declared ahead as social occasions (Strong, Medium, Soft): a drink is allowed that day. */
  socialDays?: number[]
  /** How many used jokers the player has seen announced. Only ever grows. */
  jokersAcknowledged?: number
  /** The local ISO date the attempt was given up on (status 'abandoned'). Set only by challengeRepo.giveUp. */
  abandonedOn?: string
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
  mood?: Mood
  /** Today's plan: when each task will be done, as local "HH:mm". Read by the Today duck only. */
  plans?: Partial<Record<TaskId, string>>
  /** Minutes each planned task was estimated to need when its plan was saved; fixes the plan's window so later progress can't shrink it. */
  planEstimates?: Partial<Record<TaskId, number>>
  /** 75 Soft's recovery day: the workouts task counts as done. Set only through dayEntryRepo.setRestDay. */
  restDay?: true
  /** The book the day's pages went to: the current book when pages were last logged. Unset on days logged before this was tracked. */
  bookId?: number
  completed: boolean
}

export interface Workout {
  id: number
  dayEntryId: number
  type: WorkoutType
  durationMin: number
  isOutdoor: boolean
  /** How the session felt, on the five moods of "How was today?". Unset when not given. */
  feel?: Mood
}

export interface Book {
  id: number
  title: string
  totalPages: number
  currentPage: number
  finished: boolean
  /** ISO datetime the book was finished; unset while unfinished (and for books finished before this was tracked). */
  finishedAt?: string
  /** A photo of the cover, picked from the library and shrunk. */
  cover?: Blob
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

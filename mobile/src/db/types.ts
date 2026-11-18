import type { Book as WebBook, Photo as WebPhoto } from '@schema'

export type {
  Badge,
  Challenge,
  ChallengeStatus,
  DayEntry,
  Measurement,
  SettingsRow,
  Workout,
  WorkoutType,
} from '@schema'

/** A progress photo. The picture is a file in the app's documents folder, not a Blob in the database. */
export type Photo = Omit<WebPhoto, 'blob'> & { file: string; mimeType: string }

/** A book. Its cover, if any, is a file in the app's documents folder. */
export type Book = Omit<WebBook, 'cover'> & { coverFile?: string }

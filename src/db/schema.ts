import Dexie, { type EntityTable } from 'dexie'
import type { Badge, Book, Challenge, DayEntry, Measurement, Photo, SettingsRow, Workout } from './types'

export class HardTrackerDB extends Dexie {
  challenges!: EntityTable<Challenge, 'id'>
  dayEntries!: EntityTable<DayEntry, 'id'>
  workouts!: EntityTable<Workout, 'id'>
  books!: EntityTable<Book, 'id'>
  measurements!: EntityTable<Measurement, 'id'>
  photos!: EntityTable<Photo, 'id'>
  badges!: EntityTable<Badge, 'id'>
  settings!: EntityTable<SettingsRow, 'key'>

  constructor(name = 'HardTrackerDB') {
    super(name)

    this.version(1).stores({
      challenges: '++id, status, startDate, attemptNumber',
      dayEntries: '++id, challengeId, date, dayNumber, [challengeId+dayNumber]',
      workouts: '++id, dayEntryId',
      books: '++id, finished',
      measurements: '++id, date',
      photos: '++id, date',
      badges: '++id, challengeId, badgeId, [challengeId+badgeId]',
      settings: 'key',
    })
  }
}

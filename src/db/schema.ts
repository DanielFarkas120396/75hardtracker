import Dexie, { type EntityTable, type Transaction } from 'dexie'
import { todayISO } from '../lib/dates'
import { normalizeRecords } from './normalize'
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

    // Never edit a released version in place — add a new one.
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

    // v2: same schema; only repairs data (see normalizeRecords) so v3's
    // unique indexes can be built. It has to be its own version because
    // Dexie creates a version's changed indexes *before* running that
    // version's upgrade — a unique index over existing duplicates would
    // abort the whole upgrade with a ConstraintError.
    this.version(2).stores({}).upgrade(repairForUniqueIndexes)

    // v3: at most one entry per challenge day, and each badge once per attempt.
    this.version(3).stores({
      dayEntries: '++id, challengeId, date, dayNumber, &[challengeId+dayNumber]',
      badges: '++id, challengeId, badgeId, &[challengeId+badgeId]',
    })
  }
}

async function repairForUniqueIndexes(tx: Transaction): Promise<void> {
  const challenges = tx.table<Challenge, number>('challenges')
  const dayEntries = tx.table<DayEntry, number>('dayEntries')
  const workouts = tx.table<Workout, number>('workouts')
  const badges = tx.table<Badge, number>('badges')

  const normalized = normalizeRecords(
    {
      challenges: await challenges.toArray(),
      dayEntries: await dayEntries.toArray(),
      workouts: await workouts.toArray(),
      badges: await badges.toArray(),
    },
    todayISO(),
  )

  // Rows keep their ids, so rewriting the four tables wholesale is safe.
  await challenges.clear()
  await challenges.bulkPut(normalized.challenges)
  await dayEntries.clear()
  await dayEntries.bulkPut(normalized.dayEntries)
  await workouts.clear()
  await workouts.bulkPut(normalized.workouts)
  await badges.clear()
  await badges.bulkPut(normalized.badges)
}

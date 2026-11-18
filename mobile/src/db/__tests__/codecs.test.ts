/** @jest-environment node */
import { ROWS } from '../rows'
import type { Badge, Book, Challenge, DayEntry, Measurement, Photo, Workout } from '../types'
import { freshDb } from './testDb'

/** Inserts the record with its id, reads it back through the table's codec. */
async function roundTrip<T extends { id: number }>(table: keyof typeof ROWS, record: T): Promise<T> {
  const db = await freshDb()
  const codec = ROWS[table] as unknown as (typeof ROWS)['challenges']
  await db.runAsync(codec.insertWithId, codec.toParamsWithId(record as never))
  const row = await db.getFirstAsync<Record<string, string | number | null>>(`SELECT * FROM ${table}`)
  return codec.fromRow(row!) as unknown as T
}

const fullDay: DayEntry = {
  id: 7,
  challengeId: 2,
  date: '2026-01-03',
  dayNumber: 3,
  water_ml: 3800,
  pages_read: 10,
  dietFollowed: true,
  noAlcohol: true,
  photoId: 5,
  notes: 'Cold run.',
  mood: 4,
  plans: { water: '21:00' },
  planEstimates: { water: 10 },
  restDay: true,
  bookId: 1,
  completed: true,
}
const bareDay: DayEntry = {
  id: 8,
  challengeId: 2,
  date: '2026-01-04',
  dayNumber: 4,
  water_ml: 0,
  pages_read: 0,
  dietFollowed: false,
  noAlcohol: false,
  completed: false,
}
type AnyRecord = Challenge | DayEntry | Workout | Book | Measurement | Photo | Badge
const cases: [keyof typeof ROWS, string, AnyRecord][] = [
  ['challenges', 'full', { id: 3, startDate: '2026-01-01', attemptNumber: 2, status: 'abandoned', variant: 'soft', socialDays: [3], jokersAcknowledged: 1, abandonedOn: '2026-01-20', restoredDays: [4] } satisfies Challenge],
  ['challenges', 'bare', { id: 4, startDate: '2026-01-01', attemptNumber: 1, status: 'active' } satisfies Challenge],
  ['dayEntries', 'full', fullDay],
  ['dayEntries', 'bare', bareDay],
  ['workouts', 'full', { id: 9, dayEntryId: 7, type: 'Running', durationMin: 45, isOutdoor: true, feel: 5 } satisfies Workout],
  ['workouts', 'bare', { id: 10, dayEntryId: 7, type: 'Weights', durationMin: 45, isOutdoor: false } satisfies Workout],
  ['books', 'full', { id: 1, title: 'Dune', totalPages: 600, currentPage: 600, finished: true, finishedAt: '2026-01-09T20:00:00.000Z', coverFile: '1.jpg' } satisfies Book],
  ['books', 'bare', { id: 2, title: 'Emma', totalPages: 400, currentPage: 0, finished: false } satisfies Book],
  ['measurements', 'full', { id: 1, date: '2026-01-01', weight_kg: 81.4, bodyMeasurements_cm: { waist: 88 } } satisfies Measurement],
  ['measurements', 'bare', { id: 2, date: '2026-01-02' } satisfies Measurement],
  ['photos', 'full', { id: 5, date: '2026-01-03', file: '5.jpg', mimeType: 'image/jpeg' } satisfies Photo],
  ['badges', 'full', { id: 1, badgeId: 'first-day', challengeId: 2, unlockedAt: '2026-01-01T20:00:00.000Z' } satisfies Badge],
]

it.each(cases)('%s: a %s record reads back exactly as it was saved', async (table, _kind, record) => {
  expect(await roundTrip(table, record)).toStrictEqual(record)
})

it('inserts without an id and lets the database number the row', async () => {
  const db = await freshDb()
  const { id: _id, ...workout } = cases[4][2] as Workout
  const first = await db.runAsync(ROWS.workouts.insert, ROWS.workouts.toParams(workout))
  const second = await db.runAsync(ROWS.workouts.insert, ROWS.workouts.toParams(workout))
  expect([first.lastInsertRowId, second.lastInsertRowId]).toEqual([1, 2])
})

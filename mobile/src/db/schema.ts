import type { Db } from './driver'

/**
 * The database's versions, oldest first. Never edit a released one: add a new
 * one after it. The database remembers how many it has run (PRAGMA user_version).
 *
 * Version 1 mirrors the web app's tables (src/db/types.ts). Column names equal
 * the field names. Booleans are 0 or 1; objects and arrays are JSON text. Photos
 * and book covers are files in the app's documents folder: the tables hold their
 * file names.
 */
export const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE challenges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    startDate TEXT NOT NULL,
    attemptNumber INTEGER NOT NULL,
    status TEXT NOT NULL,
    variant TEXT,
    socialDays TEXT,
    jokersAcknowledged INTEGER,
    abandonedOn TEXT,
    restoredDays TEXT
  );
  CREATE TABLE dayEntries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    challengeId INTEGER NOT NULL,
    date TEXT NOT NULL,
    dayNumber INTEGER NOT NULL,
    water_ml INTEGER NOT NULL,
    pages_read INTEGER NOT NULL,
    dietFollowed INTEGER NOT NULL,
    noAlcohol INTEGER NOT NULL,
    photoId INTEGER,
    notes TEXT,
    mood,
    plans TEXT,
    planEstimates TEXT,
    restDay INTEGER,
    bookId INTEGER,
    completed INTEGER NOT NULL,
    UNIQUE (challengeId, dayNumber)
  );
  CREATE TABLE workouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dayEntryId INTEGER NOT NULL,
    type TEXT NOT NULL,
    durationMin INTEGER NOT NULL,
    isOutdoor INTEGER NOT NULL,
    feel
  );
  CREATE TABLE books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    totalPages INTEGER NOT NULL,
    currentPage INTEGER NOT NULL,
    finished INTEGER NOT NULL,
    finishedAt TEXT,
    coverFile TEXT
  );
  CREATE TABLE measurements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    weight_kg REAL,
    bodyMeasurements_cm TEXT
  );
  CREATE TABLE photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    file TEXT NOT NULL,
    mimeType TEXT NOT NULL
  );
  CREATE TABLE badges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    badgeId TEXT NOT NULL,
    challengeId INTEGER NOT NULL,
    unlockedAt TEXT NOT NULL,
    UNIQUE (challengeId, badgeId)
  );
  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE INDEX dayEntries_date ON dayEntries (date);
  CREATE INDEX workouts_dayEntryId ON workouts (dayEntryId);
  CREATE INDEX photos_date ON photos (date);
  CREATE INDEX measurements_date ON measurements (date);
  `,
]

/** Every table, for the operations that empty the database (an import, the developer seed). */
export const TABLE_NAMES = [
  'challenges',
  'dayEntries',
  'workouts',
  'books',
  'measurements',
  'photos',
  'badges',
  'settings',
] as const

/**
 * Brings the database up to the latest version. Safe to run at every launch.
 * A database written by a newer version of the app is left as it is.
 */
export async function migrate(db: Db): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version')
  for (let version = row?.user_version ?? 0; version < MIGRATIONS.length; version++) {
    const next = version + 1
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[version])
      await db.execAsync(`PRAGMA user_version = ${next}`)
    })
  }
}

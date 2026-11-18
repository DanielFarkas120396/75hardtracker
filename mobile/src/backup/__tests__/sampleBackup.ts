import type { ExportPayload } from '@logic/backupFormat'

export const base64 = (text: string) => Buffer.from(text).toString('base64')

/**
 * A backup as the web app exports it: a failed first attempt, a running
 * 75 Soft attempt with three days, two books (one with a cover), weigh-ins,
 * three photos, a badge and a few settings. `exportedAt` is the attempt's Day 3,
 * so importing it on `SAMPLE_TODAY` leaves no gap to ask about.
 */
export const SAMPLE_TODAY = '2026-03-03'

export function sampleBackup(): ExportPayload {
  return {
    version: 1,
    exportedAt: '2026-03-03T21:15:00.000Z',
    challenges: [
      { id: 1, startDate: '2026-01-05', attemptNumber: 1, status: 'failed' },
      { id: 2, startDate: '2026-03-01', attemptNumber: 2, status: 'active', variant: 'soft', jokersAcknowledged: 0 },
    ],
    dayEntries: [
      {
        id: 20,
        challengeId: 2,
        date: '2026-03-01',
        dayNumber: 1,
        water_ml: 1200,
        pages_read: 4,
        dietFollowed: true,
        noAlcohol: true,
        photoId: 10,
        completed: false,
      },
      {
        id: 21,
        challengeId: 2,
        date: '2026-03-02',
        dayNumber: 2,
        water_ml: 900,
        pages_read: 0,
        dietFollowed: false,
        noAlcohol: true,
        photoId: 11,
        notes: 'Slow day.',
        mood: 2,
        plans: { water: '21:00' },
        planEstimates: { water: 10 },
        bookId: 1,
        completed: false,
      },
      {
        id: 22,
        challengeId: 2,
        date: '2026-03-03',
        dayNumber: 3,
        water_ml: 0,
        pages_read: 0,
        dietFollowed: false,
        noAlcohol: false,
        photoId: 12,
        completed: false,
      },
    ],
    workouts: [
      { id: 30, dayEntryId: 21, type: 'Running', durationMin: 45, isOutdoor: true, feel: 4 },
      { id: 31, dayEntryId: 21, type: 'Weights', durationMin: 30, isOutdoor: false },
    ],
    books: [
      { id: 1, title: 'Dune', totalPages: 600, currentPage: 4, finished: false, coverBase64: base64('cover of Dune'), coverMimeType: 'image/png' },
      { id: 2, title: 'Emma', totalPages: 400, currentPage: 400, finished: true, finishedAt: '2026-02-01T20:00:00.000Z' },
    ],
    measurements: [
      { id: 1, date: '2026-03-01', weight_kg: 81.4 },
      { id: 2, date: '2026-03-02', weight_kg: 81.1, bodyMeasurements_cm: { waist: 88 } },
    ],
    photos: [
      { id: 10, date: '2026-03-01', blobBase64: base64('photo ten'), mimeType: 'image/jpeg' },
      { id: 11, date: '2026-03-02', blobBase64: base64('photo eleven'), mimeType: 'image/jpeg' },
      { id: 12, date: '2026-03-03', blobBase64: base64('photo twelve'), mimeType: 'image/webp' },
    ],
    badges: [{ id: 1, badgeId: 'first-day', challengeId: 2, unlockedAt: '2026-03-01T20:00:00.000Z' }],
    settings: [
      { key: 'bedtime', value: '22:30' },
      { key: 'profile', value: { name: 'Daniel', why: 'A fresh start', onboardedAt: '2026-01-05T08:00:00.000Z' } },
      { key: 'currentBookId', value: 1 },
      { key: 'lastExportAt', value: '2026-02-20T10:00:00.000Z' },
    ],
  }
}

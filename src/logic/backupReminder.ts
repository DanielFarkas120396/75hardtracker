/** The weekly reminder starts on Sunday at this local hour. */
export const REMINDER_HOUR = 18

/** A backup at least this old is reminded about on any day, not only on Sunday evening. */
export const STALE_BACKUP_DAYS = 7

const SUNDAY = 0
const DAY_MS = 24 * 60 * 60 * 1000

/** The latest Sunday 18:00 (local time) at or before `now`. */
export function lastReminderWindowStart(now: Date): Date {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), REMINDER_HOUR)
  start.setDate(start.getDate() - now.getDay())
  if (start.getTime() > now.getTime()) start.setDate(start.getDate() - 7)
  return start
}

/** Local midnight at the end of `now`'s day — where "Later" snoozes to. */
export function snoozeUntil(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
}

interface ReminderInput {
  now: Date
  /** ISO datetime of the last backup, if any. */
  lastExportAt: string | null
  /** ISO datetime until which the reminder is snoozed, if any. */
  snoozedUntil: string | null
}

/**
 * Whether to nudge the player to export a backup: from Sunday 18:00 when none
 * was made since then, or on any later day while the last backup is a week
 * old or more (the catch-up if Sunday evening passed without opening the app).
 */
export function shouldRemindBackup({ now, lastExportAt, snoozedUntil }: ReminderInput): boolean {
  if (snoozedUntil !== null && now.getTime() < new Date(snoozedUntil).getTime()) return false

  const windowStart = lastReminderWindowStart(now)
  const last = lastExportAt === null ? null : new Date(lastExportAt).getTime()
  const lastIsValid = last !== null && Number.isFinite(last)
  if (lastIsValid && last >= windowStart.getTime()) return false

  const inSundayWindow = now.getDay() === SUNDAY && now.getHours() >= REMINDER_HOUR
  if (inSundayWindow) return true

  return lastIsValid && now.getTime() - last >= STALE_BACKUP_DAYS * DAY_MS
}

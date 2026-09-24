import { addDays, differenceInCalendarDays, format, isValid, parseISO, startOfDay } from 'date-fns'

const ISO_DATE_FORMAT = 'yyyy-MM-dd'

/** Today's date as an ISO date string (yyyy-MM-dd), in local time. */
export function todayISO(now: Date = new Date()): string {
  return format(now, ISO_DATE_FORMAT)
}

/**
 * True for a real calendar date written as yyyy-MM-dd. Rejects empty
 * strings, other formats and impossible dates like 2026-02-30.
 */
export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = parseISO(value)
  return isValid(date) && format(date, ISO_DATE_FORMAT) === value
}

/**
 * 1-indexed day number for `dateISO` relative to a challenge's
 * `startDateISO`, or NaN if either date is invalid. Both are parsed as
 * *local* calendar dates: `new Date('yyyy-MM-dd')` would mean UTC midnight,
 * which is the previous day anywhere west of UTC.
 */
export function dayNumberForDate(startDateISO: string, dateISO: string): number {
  if (!isValidISODate(startDateISO) || !isValidISODate(dateISO)) return Number.NaN
  return differenceInCalendarDays(parseISO(dateISO), parseISO(startDateISO)) + 1
}

/** The ISO date that is `days` calendar days after `dateISO` (negative to go back). */
export function addDaysISO(dateISO: string, days: number): string {
  return format(addDays(parseISO(dateISO), days), ISO_DATE_FORMAT)
}

/** The ISO date of `dayNumber` in a challenge that starts on `startDateISO`. */
export function dateForDayNumber(startDateISO: string, dayNumber: number): string {
  return addDaysISO(startDateISO, dayNumber - 1)
}

/** Milliseconds from `now` until the next local midnight (DST-aware). */
export function msUntilNextLocalMidnight(now: Date = new Date()): number {
  return startOfDay(addDays(now, 1)).getTime() - now.getTime()
}

/** A short human date for display, e.g. "24 Sep 2026". */
export function formatDisplayDate(dateISO: string): string {
  return isValidISODate(dateISO) ? format(parseISO(dateISO), 'd MMM yyyy') : dateISO
}

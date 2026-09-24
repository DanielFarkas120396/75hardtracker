import { differenceInCalendarDays, formatISO, startOfDay } from 'date-fns'

/** Today's date as an ISO date string (yyyy-MM-dd), in local time. */
export function todayISO(): string {
  return formatISO(startOfDay(new Date()), { representation: 'date' })
}

/** 1-indexed day number for `dateISO` relative to a challenge's `startDateISO`. */
export function dayNumberForDate(startDateISO: string, dateISO: string): number {
  const start = startOfDay(new Date(startDateISO))
  const date = startOfDay(new Date(dateISO))
  return differenceInCalendarDays(date, start) + 1
}

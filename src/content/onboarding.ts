import { addDaysISO, formatDisplayDate } from '../lib/dates'

/** Reasons the welcome flow suggests; a tap fills the field, which stays editable. */
export const WHY_IDEAS = [
  'Prove I can finish what I start',
  'Get in the best shape of my life',
  'Build real discipline',
  'Clear my head',
  'A fresh start',
] as const

/** When a new attempt starts, for the ready step: "today", "tomorrow" or "on 3 Oct 2026". */
export function startsWhen(startDate: string, today: string): string {
  if (startDate === today) return 'today'
  if (startDate === addDaysISO(today, 1)) return 'tomorrow'
  return `on ${formatDisplayDate(startDate)}`
}

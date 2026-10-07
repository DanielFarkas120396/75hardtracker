import { addDaysISO, dateForDayNumber, dayNumberForDate, formatDisplayDate, formatShortDay } from '../lib/dates'
import { CHALLENGE_LENGTH } from '../logic/constants'
import { formatHHmm } from '../logic/menace'
import type { Ruleset } from '../logic/rulesets'

/** Reasons the welcome flow suggests; a tap fills the empty field, which stays editable. */
export const WHY_IDEAS = ['Prove I can finish what I start', 'Build real discipline', 'Clear my head', 'A fresh start'] as const

/** When a new attempt starts, for the ready step: "today", "tomorrow" or "on 3 Oct 2026". */
export function startsWhen(startDate: string, today: string): string {
  if (startDate === today) return 'today'
  if (startDate === addDaysISO(today, 1)) return 'tomorrow'
  return `on ${formatDisplayDate(startDate)}`
}

/** Both ends of an attempt that starts on `startDate`, for the start step: "Day 1: Tue 6 Oct · Day 75: Sat 19 Dec." */
export function finishLine(startDate: string): string {
  const last = formatShortDay(dateForDayNumber(startDate, CHALLENGE_LENGTH))
  return `Day 1: ${formatShortDay(startDate)} · Day ${CHALLENGE_LENGTH}: ${last}.`
}

/** Past this many days, the deal says the wait is long. */
const LONG_WAIT_DAYS = 14

/** How long until a later start, for the deal: "Starts in 3 days.", or null for today and tomorrow. */
export function startsInLine(startDate: string, today: string): string | null {
  const days = dayNumberForDate(today, startDate) - 1
  if (days <= 1) return null
  return days > LONG_WAIT_DAYS ? `Starts in ${days} days. That's a long wait.` : `Starts in ${days} days.`
}

/** The start choice before the player touches it: tomorrow in the evening, when today is nearly over. */
export function defaultStartChoice(nowMin: number): 'today' | 'tomorrow' {
  return nowMin >= LATE_START_FROM_MIN ? 'tomorrow' : 'today'
}

/** From this time on, starting today gets a warning. */
export const LATE_START_FROM_MIN = 18 * 60

/** A nudge on the start step when "Today" is picked in the evening; null earlier in the day. */
export function lateStartHint(nowMin: number, rules: Ruleset): string | null {
  if (nowMin < LATE_START_FROM_MIN) return null
  const workouts = rules.requiredWorkouts === 2 ? 'two workouts' : 'a workout'
  return `It's ${formatHHmm(nowMin)}. Today means ${workouts} before midnight. Tomorrow might be smarter.`
}

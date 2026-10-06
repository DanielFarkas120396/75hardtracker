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

/** The last day of an attempt that starts on `startDate`, for the start step: "Day 75 is Fri 19 Dec." */
export function finishLine(startDate: string): string {
  return `Day ${CHALLENGE_LENGTH} is ${formatShortDay(dateForDayNumber(startDate, CHALLENGE_LENGTH))}.`
}

/** How long until a later start, for the deal: "Starts in 3 days.", or null for today and tomorrow. */
export function startsInLine(startDate: string, today: string): string | null {
  const days = dayNumberForDate(today, startDate) - 1
  return days > 1 ? `Starts in ${days} days.` : null
}

/** From this time on, starting today gets a warning. */
export const LATE_START_FROM_MIN = 18 * 60

/** A nudge on the start step when "Today" is picked in the evening; null earlier in the day. */
export function lateStartHint(nowMin: number, rules: Ruleset): string | null {
  if (nowMin < LATE_START_FROM_MIN) return null
  const workouts = rules.requiredWorkouts === 2 ? 'two workouts' : 'a workout'
  return `It's ${formatHHmm(nowMin)}. Today means ${workouts} before midnight. Tomorrow might be smarter.`
}

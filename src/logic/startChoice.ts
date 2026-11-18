import { addDaysISO, isValidISODate } from './dates'

export type StartChoice = 'today' | 'tomorrow' | 'pick'

/** How far ahead a new attempt can be set to start. */
export const START_MAX_DAYS_AHEAD = 60

/** What a choice gives: the start date (ISO), the latest one allowed (ISO), and why that date can't start an attempt (null when it can). */
export function resolveStartChoice(input: { choice: StartChoice; pickedDate: string; today: string }): {
  startDate: string
  maxDate: string
  dateError: string | null
} {
  const { choice, pickedDate, today } = input
  const maxDate = addDaysISO(today, START_MAX_DAYS_AHEAD)
  const startDate = choice === 'today' ? today : choice === 'tomorrow' ? addDaysISO(today, 1) : pickedDate
  // ISO strings compare chronologically.
  const dateError = !isValidISODate(startDate)
    ? 'Pick a start date.'
    : startDate < today
      ? "The start can't be in the past."
      : startDate > maxDate
        ? `Start within the next ${START_MAX_DAYS_AHEAD} days.`
        : null

  return { startDate, maxDate, dateError }
}

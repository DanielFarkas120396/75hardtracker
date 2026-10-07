import { useState } from 'react'
import { addDaysISO, isValidISODate } from '../lib/dates'

export type StartChoice = 'today' | 'tomorrow' | 'pick'

/** How far ahead a new attempt can be set to start. */
export const START_MAX_DAYS_AHEAD = 60

export interface StartDateChoiceState {
  choice: StartChoice
  setChoice: (choice: StartChoice) => void
  pickedDate: string
  setPickedDate: (date: string) => void
  /** The start date the choice gives (ISO). */
  startDate: string
  /** The latest start date allowed (ISO). */
  maxDate: string
  /** Why that date can't start an attempt, or null when it can. */
  dateError: string | null
}

/** Where a choice starts from: the welcome flow's saved draft. */
export interface StartDateChoiceInitial {
  choice: StartChoice
  pickedDate: string
}

/**
 * When an attempt starts: today, tomorrow or a picked date (tomorrow at first), never in the past nor too far ahead.
 * `defaultChoice` applies when there's no `initial` (the evening passes 'tomorrow').
 */
export function useStartDateChoice(
  today: string,
  initial?: StartDateChoiceInitial,
  defaultChoice: StartChoice = 'today',
): StartDateChoiceState {
  const [choice, setChoice] = useState<StartChoice>(initial?.choice ?? defaultChoice)
  const [pickedDate, setPickedDate] = useState(initial?.pickedDate ?? addDaysISO(today, 1))

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

  return { choice, setChoice, pickedDate, setPickedDate, startDate, maxDate, dateError }
}

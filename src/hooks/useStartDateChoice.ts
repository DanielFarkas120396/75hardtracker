import { useState } from 'react'
import { addDaysISO, isValidISODate } from '../lib/dates'

export type StartChoice = 'today' | 'tomorrow' | 'pick'

export interface StartDateChoiceState {
  choice: StartChoice
  setChoice: (choice: StartChoice) => void
  pickedDate: string
  setPickedDate: (date: string) => void
  /** The start date the choice gives (ISO). */
  startDate: string
  /** Why that date can't start an attempt, or null when it can. */
  dateError: string | null
}

/** When an attempt starts: today, tomorrow or a picked date, never in the past. */
export function useStartDateChoice(today: string): StartDateChoiceState {
  const [choice, setChoice] = useState<StartChoice>('today')
  const [pickedDate, setPickedDate] = useState(today)

  const startDate = choice === 'today' ? today : choice === 'tomorrow' ? addDaysISO(today, 1) : pickedDate
  // ISO strings compare chronologically.
  const dateError = !isValidISODate(startDate)
    ? 'Pick a start date.'
    : startDate < today
      ? "The start can't be in the past."
      : null

  return { choice, setChoice, pickedDate, setPickedDate, startDate, dateError }
}

import { useState } from 'react'
import { addDaysISO } from '../lib/dates'
import { resolveStartChoice, START_MAX_DAYS_AHEAD, type StartChoice } from '../logic/startChoice'

export { START_MAX_DAYS_AHEAD, type StartChoice }

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

  const { startDate, maxDate, dateError } = resolveStartChoice({ choice, pickedDate, today })

  return { choice, setChoice, pickedDate, setPickedDate, startDate, maxDate, dateError }
}

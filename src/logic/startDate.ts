import { isValidISODate } from '../lib/dates'
import { LAST_START_DATE_EDITABLE_DAY } from './constants'

export type StartDateChangeResult =
  | { ok: true }
  | { ok: false; reason: 'empty' | 'invalid' | 'past' | 'locked' }

/** Whether the start date may still be moved: before Day 1, or on Day 1 itself. */
export function isStartDateEditable(todayDayNumber: number): boolean {
  // NaN (a broken start date) stays editable so it can be repaired.
  return !(todayDayNumber > LAST_START_DATE_EDITABLE_DAY)
}

/**
 * Validates moving an active attempt's start date to `proposed`. The new
 * date must be today or later — past days can't be backfilled — and the
 * date locks once the attempt is past Day 1.
 */
export function validateStartDateChange(params: {
  proposed: string
  today: string
  todayDayNumber: number
}): StartDateChangeResult {
  if (!isStartDateEditable(params.todayDayNumber)) return { ok: false, reason: 'locked' }
  if (params.proposed.trim() === '') return { ok: false, reason: 'empty' }
  if (!isValidISODate(params.proposed)) return { ok: false, reason: 'invalid' }
  // yyyy-MM-dd strings compare chronologically.
  if (params.proposed < params.today) return { ok: false, reason: 'past' }
  return { ok: true }
}

import { dayNumberForDate } from '../lib/dates'
import { CHALLENGE_LENGTH } from './constants'
import type { DayCompletionSummary } from './types'

/** The days as the rules see them: a day the player said they did counts as done, whatever is logged. */
export function withRestoredDays(summaries: DayCompletionSummary[], restoredDays: readonly number[] = []): DayCompletionSummary[] {
  const restored = new Set(restoredDays)
  const logged = summaries.map((s) => (restored.has(s.dayNumber) ? { ...s, completed: true } : s))
  const unlogged = [...restored].filter((day) => !summaries.some((s) => s.dayNumber === day))
  return [...logged, ...unlogged.map((dayNumber) => ({ dayNumber, completed: true }))]
}

/**
 * The days a backup couldn't know about: from the day it was made up to
 * yesterday, never past Day 75, unless already complete. Earlier misses
 * aren't listed, and today is still open.
 */
export function backupGapDays(params: {
  startDate: string
  /** The local date the backup was made. */
  backupDate: string
  today: string
  summaries: DayCompletionSummary[]
}): number[] {
  const { startDate, backupDate, today, summaries } = params
  const completed = new Set(summaries.filter((s) => s.completed).map((s) => s.dayNumber))
  const firstDay = Math.max(dayNumberForDate(startDate, backupDate), 1)
  const lastDay = Math.min(dayNumberForDate(startDate, today) - 1, CHALLENGE_LENGTH)
  const days: number[] = []
  for (let day = firstDay; day <= lastDay; day++) {
    if (!completed.has(day)) days.push(day)
  }
  return days
}

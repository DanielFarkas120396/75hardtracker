import { CHALLENGE_LENGTH } from './constants'
import type { DayCompletionSummary } from './types'

/**
 * Consecutive completed days ending at `dayNumber` (inclusive), counting
 * backward. 0 if that day isn't complete or has no entry.
 */
export function streakEndingAt(entries: DayCompletionSummary[], dayNumber: number): number {
  if (!Number.isFinite(dayNumber) || dayNumber < 1) return 0

  const completedDays = new Set(entries.filter((e) => e.completed).map((e) => e.dayNumber))
  let streak = 0
  for (let day = dayNumber; day >= 1 && completedDays.has(day); day--) {
    streak++
  }
  return streak
}

/**
 * The streak to show on `todayDayNumber`: consecutive completed days ending
 * today if today is already complete, otherwise ending yesterday — so a day
 * that's still in progress never drops the flame to 0. Likewise an
 * unfinished late day (yesterday, until noon): the streak then ends the day
 * before it. Days after the end of the challenge count from the final day.
 */
export function calculateStreak(
  entries: DayCompletionSummary[],
  todayDayNumber: number,
  lateDay: number | null = null,
): number {
  if (!Number.isFinite(todayDayNumber) || todayDayNumber < 1) return 0

  const isComplete = (day: number) => entries.some((e) => e.dayNumber === day && e.completed)
  const today = Math.min(todayDayNumber, CHALLENGE_LENGTH)
  if (isComplete(today)) return streakEndingAt(entries, today)
  const yesterday = today === todayDayNumber ? today - 1 : today
  const yesterdayOpen = yesterday === lateDay && !isComplete(yesterday)
  return streakEndingAt(entries, yesterdayOpen ? yesterday - 1 : yesterday)
}

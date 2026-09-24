import { TASK_IDS, taskCompletionMap } from './dayCompletion'
import { MILESTONES, PERFECT_DAY_BONUS, STREAK_MILESTONE_BONUS, XP_PER_TASK } from './constants'
import type { DayTaskData } from './types'

export interface XpBreakdown {
  taskXp: number
  perfectDayBonus: number
  streakMilestoneBonus: number
  total: number
}

/** The bonus for a streak that has just reached a milestone length (7, 14, …), else 0. */
export function streakMilestoneBonus(streakLengthAfterThisDay: number): number {
  return (MILESTONES as readonly number[]).includes(streakLengthAfterThisDay) ? STREAK_MILESTONE_BONUS : 0
}

/**
 * XP earned for a single day's data. `streakLengthAfterThisDay` is the
 * streak ending on this day with the day itself counted — use
 * `streakEndingAt(entries, day)`, which is 0 while the day is incomplete, so
 * an unfinished day can never collect a milestone bonus.
 */
export function calculateDayXp(data: DayTaskData, streakLengthAfterThisDay: number): XpBreakdown {
  const completion = taskCompletionMap(data)
  const completedTaskCount = Object.values(completion).filter(Boolean).length
  const taskXp = completedTaskCount * XP_PER_TASK

  const isPerfectDay = completedTaskCount === Object.keys(completion).length
  const perfectDayBonus = isPerfectDay ? PERFECT_DAY_BONUS : 0
  const milestoneBonus = isPerfectDay ? streakMilestoneBonus(streakLengthAfterThisDay) : 0

  return {
    taskXp,
    perfectDayBonus,
    streakMilestoneBonus: milestoneBonus,
    total: taskXp + perfectDayBonus + milestoneBonus,
  }
}

/** Total XP for a day on which all five tasks are complete. */
export function completedDayXp(streakLengthAfterThisDay: number): number {
  return TASK_IDS.length * XP_PER_TASK + PERFECT_DAY_BONUS + streakMilestoneBonus(streakLengthAfterThisDay)
}

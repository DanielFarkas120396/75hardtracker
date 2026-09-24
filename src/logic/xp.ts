import { taskCompletionMap } from './dayCompletion'
import { MILESTONES, PERFECT_DAY_BONUS, STREAK_MILESTONE_BONUS, XP_PER_TASK } from './constants'
import type { DayTaskData } from './types'

export interface XpBreakdown {
  taskXp: number
  perfectDayBonus: number
  streakMilestoneBonus: number
  total: number
}

/**
 * XP earned for a single day's data. `streakLengthAfterThisDay` is the
 * streak as it stands once this day's completion has been factored in —
 * pass 0 (or omit milestone-eligibility) if this day isn't complete.
 */
export function calculateDayXp(data: DayTaskData, streakLengthAfterThisDay: number): XpBreakdown {
  const completion = taskCompletionMap(data)
  const completedTaskCount = Object.values(completion).filter(Boolean).length
  const taskXp = completedTaskCount * XP_PER_TASK

  const isPerfectDay = completedTaskCount === Object.keys(completion).length
  const perfectDayBonus = isPerfectDay ? PERFECT_DAY_BONUS : 0

  const streakMilestoneBonus = (MILESTONES as readonly number[]).includes(streakLengthAfterThisDay)
    ? STREAK_MILESTONE_BONUS
    : 0

  return {
    taskXp,
    perfectDayBonus,
    streakMilestoneBonus,
    total: taskXp + perfectDayBonus + streakMilestoneBonus,
  }
}

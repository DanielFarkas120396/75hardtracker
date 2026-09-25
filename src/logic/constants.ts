export const CHALLENGE_LENGTH = 75
export const WATER_TARGET_ML = 3800
export const PAGES_TARGET = 10
export const MIN_WORKOUT_MIN = 45
export const REQUIRED_QUALIFYING_WORKOUTS = 2
/** How many workouts can be logged on one day. */
export const MAX_WORKOUTS = 2
export const MILESTONES = [7, 14, 21, 30, 50, 75] as const

export const XP_PER_TASK = 10
export const PERFECT_DAY_BONUS = 25
export const STREAK_MILESTONE_BONUS = 100

/** The start date can be moved while the attempt hasn't started, or on Day 1 — never later. */
export const LAST_START_DATE_EDITABLE_DAY = 1

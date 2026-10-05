export const CHALLENGE_LENGTH = 75
/** How many workouts can be logged on one day. */
export const MAX_WORKOUTS = 2
/** Every activity a workout can be, in the order the app lists them. `WorkoutType` is derived from it. */
export const WORKOUT_TYPES = ['Running', 'Walking', 'Weights', 'Yoga', 'Cycling', 'Swimming', 'Other'] as const
export const MILESTONES = [7, 14, 21, 30, 50, 75] as const

/** The start date can be moved while the attempt hasn't started, or on Day 1 — never later. */
export const LAST_START_DATE_EDITABLE_DAY = 1

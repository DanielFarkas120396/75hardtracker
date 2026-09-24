import { MILESTONES, WATER_TARGET_ML } from './constants'
import { isDayComplete, isQualifyingWorkout } from './dayCompletion'
import { calculateStreak } from './streak'
import type { DayTaskData } from './types'

export type BadgeCategory = 'milestone' | 'first'

export interface BadgeDefinition {
  id: string
  category: BadgeCategory
  name: string
  description: string
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  ...MILESTONES.map(
    (day): BadgeDefinition => ({
      id: `streak-${day}`,
      category: 'milestone',
      name: `Day ${day} Streak`,
      description: `Completed ${day} days in a row.`,
    }),
  ),
  { id: 'first-workout', category: 'first', name: 'First Rep', description: 'Logged your first workout.' },
  {
    id: 'first-outdoor-workout',
    category: 'first',
    name: 'Fresh Air',
    description: 'Logged your first outdoor workout.',
  },
  {
    id: 'first-perfect-day',
    category: 'first',
    name: 'Perfect Day',
    description: 'Completed all five tasks in a single day for the first time.',
  },
  {
    id: 'first-book-finished',
    category: 'first',
    name: 'Bookworm',
    description: 'Finished your first book.',
  },
  {
    id: 'first-water-goal',
    category: 'first',
    name: 'Hydrated',
    description: 'Hit your water goal for the first time.',
  },
  {
    id: 'first-photo',
    category: 'first',
    name: 'Say Cheese',
    description: 'Took your first progress photo.',
  },
]

/**
 * What has happened so far in one attempt — everything the badge rules need.
 * Badges are scoped per attempt, so a "first" badge means "first time in
 * this attempt".
 */
export interface BadgeContext {
  /** The attempt's current streak (see calculateStreak). */
  streakLength: number
  perfectDays: number
  workoutsLogged: number
  outdoorQualifyingWorkouts: number
  waterGoalDays: number
  photosTaken: number
  /** Books finished since this attempt started. */
  booksFinished: number
}

/**
 * Whether a finished book counts toward this attempt's Bookworm badge: only
 * if it was finished (local date `finishedOn`) on or after the attempt's
 * first day. A book with no known finish date never counts.
 */
export function bookCountsForAttempt(finishedOn: string | undefined, attemptStartDate: string): boolean {
  return finishedOn !== undefined && finishedOn >= attemptStartDate
}

export interface BadgeDayInput {
  dayNumber: number
  data: DayTaskData
}

/** Tallies an attempt's days (plus its finished books) into a BadgeContext. */
export function buildBadgeContext(params: {
  days: BadgeDayInput[]
  todayDayNumber: number
  booksFinished: number
}): BadgeContext {
  const { days } = params
  const allWorkouts = days.flatMap((d) => d.data.workouts)

  return {
    streakLength: calculateStreak(
      days.map((d) => ({ dayNumber: d.dayNumber, completed: isDayComplete(d.data) })),
      params.todayDayNumber,
    ),
    perfectDays: days.filter((d) => isDayComplete(d.data)).length,
    workoutsLogged: allWorkouts.length,
    outdoorQualifyingWorkouts: allWorkouts.filter((w) => isQualifyingWorkout(w) && w.isOutdoor).length,
    waterGoalDays: days.filter((d) => d.data.water_ml >= WATER_TARGET_ML).length,
    photosTaken: days.filter((d) => d.data.hasPhoto).length,
    booksFinished: params.booksFinished,
  }
}

/**
 * Ids of every badge the attempt has earned that isn't unlocked yet.
 * Conditions are "has it ever happened in this attempt", not "did it happen
 * today", so a badge whose unlock was missed (app closed mid-write, etc.)
 * is picked up on the next evaluation instead of being lost for good.
 */
export function evaluateNewBadges(context: BadgeContext, alreadyUnlockedBadgeIds: ReadonlySet<string>): string[] {
  const newlyUnlocked: string[] = []

  const unlock = (id: string, condition: boolean) => {
    if (condition && !alreadyUnlockedBadgeIds.has(id)) {
      newlyUnlocked.push(id)
    }
  }

  for (const milestone of MILESTONES) {
    unlock(`streak-${milestone}`, context.streakLength >= milestone)
  }

  unlock('first-workout', context.workoutsLogged > 0)
  unlock('first-outdoor-workout', context.outdoorQualifyingWorkouts > 0)
  unlock('first-perfect-day', context.perfectDays > 0)
  unlock('first-book-finished', context.booksFinished > 0)
  unlock('first-water-goal', context.waterGoalDays > 0)
  unlock('first-photo', context.photosTaken > 0)

  return newlyUnlocked
}

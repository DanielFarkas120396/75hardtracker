import { MILESTONES } from './constants'

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
 * Everything the badge-unlock evaluation needs to know about "today" and
 * the history leading up to it. Assembled by the caller (a hook, in
 * practice) from Dexie data — this module stays free of any persistence
 * dependency.
 */
export interface BadgeContext {
  /** Streak length once today's entry is factored in. */
  streakLength: number
  isPerfectDay: boolean
  todayHasAnyWorkout: boolean
  todayHasOutdoorQualifyingWorkout: boolean
  workoutsLoggedBeforeToday: number
  outdoorQualifyingWorkoutsLoggedBeforeToday: number
  todayHitWaterGoal: boolean
  waterGoalHitOnAnyPriorDay: boolean
  todayHasPhoto: boolean
  photosLoggedBeforeToday: number
  bookFinishedToday: boolean
  booksFinishedBeforeToday: number
}

/** Returns the ids of badges newly unlocked by today's data, excluding any already unlocked. */
export function evaluateNewBadges(context: BadgeContext, alreadyUnlockedBadgeIds: ReadonlySet<string>): string[] {
  const newlyUnlocked: string[] = []

  const unlock = (id: string, condition: boolean) => {
    if (condition && !alreadyUnlockedBadgeIds.has(id)) {
      newlyUnlocked.push(id)
    }
  }

  for (const milestone of MILESTONES) {
    unlock(`streak-${milestone}`, context.streakLength === milestone)
  }

  unlock('first-workout', context.workoutsLoggedBeforeToday === 0 && context.todayHasAnyWorkout)
  unlock(
    'first-outdoor-workout',
    context.outdoorQualifyingWorkoutsLoggedBeforeToday === 0 && context.todayHasOutdoorQualifyingWorkout,
  )
  unlock('first-perfect-day', context.isPerfectDay)
  unlock('first-book-finished', context.booksFinishedBeforeToday === 0 && context.bookFinishedToday)
  unlock('first-water-goal', !context.waterGoalHitOnAnyPriorDay && context.todayHitWaterGoal)
  unlock('first-photo', context.photosLoggedBeforeToday === 0 && context.todayHasPhoto)

  return newlyUnlocked
}

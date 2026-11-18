import type { IconName } from '../components/icons/icons'
import type { WorkoutType } from '../logic/types'

/** Each activity's logo. */
export const ACTIVITY_ICONS: Record<WorkoutType, IconName> = {
  Running: 'running',
  Walking: 'walking',
  Weights: 'weights',
  Yoga: 'yoga',
  Cycling: 'cycling',
  Swimming: 'swimming',
  Other: 'stopwatch',
}

export { formatMinutes } from '../logic/duration'

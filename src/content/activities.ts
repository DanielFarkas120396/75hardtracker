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

/** Training time: "45 min" under an hour, "8h 55m" from one. */
export function formatMinutes(total: number): string {
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes} min`
}

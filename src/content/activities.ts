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

/** The app's one way to write a duration: "45 min" under an hour, then "1h", "1h05", "53h15". */
export function formatMinutes(total: number): string {
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  if (hours === 0) return `${minutes} min`
  return minutes === 0 ? `${hours}h` : `${hours}h${String(minutes).padStart(2, '0')}`
}

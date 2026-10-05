import type { IconName } from '../../components/icons/icons'
import type { BoardTask } from '../../content/taskStatus'

export interface TaskTone {
  /** The tile's and the sheet header's background. */
  tint: string
  /** Text and icons on the tint (4.5:1, see brandColors.test). */
  ink: string
  /** The progress bar's fill. */
  bar: string
}

/** A pastel per task, the same in every world; the mood tile stays neutral. */
export const TASK_TONES: Record<BoardTask, TaskTone> = {
  workouts: { tint: 'bg-orange-light', ink: 'text-orange-ink', bar: 'bg-orange' },
  diet: { tint: 'bg-green-light', ink: 'text-green-ink', bar: 'bg-green' },
  water: { tint: 'bg-blue-light', ink: 'text-blue-ink', bar: 'bg-blue' },
  reading: { tint: 'bg-yellow-light', ink: 'text-yellow-ink', bar: 'bg-yellow' },
  photo: { tint: 'bg-purple-light', ink: 'text-purple-ink', bar: 'bg-purple' },
  notes: { tint: 'bg-surface ring-1 ring-ink/10 dark:ring-0', ink: 'text-ink-muted', bar: 'bg-ink-muted' },
}

export const TASK_ICONS: Record<BoardTask, IconName> = {
  workouts: 'workout',
  diet: 'diet',
  water: 'water',
  reading: 'reading',
  photo: 'photo',
  notes: 'notes',
}

import type { IconName } from '../../components/icons/icons'
import type { BoardTask } from '../../content/taskStatus'

export interface TaskTone {
  /** The sheet header's background and the tile's icon well. */
  tint: string
  /** Text and icons on the tint (4.5:1, see worldColors.test). */
  ink: string
  /** The progress bar's fill. */
  bar: string
}

/** Every task wears the world's colour (the Ember look); done tiles turn green in TaskBoard. */
export const TASK_TONE: TaskTone = { tint: 'bg-world-soft', ink: 'text-world-ink', bar: 'bg-world' }

export const TASK_ICONS: Record<BoardTask, IconName> = {
  workouts: 'workout',
  diet: 'diet',
  water: 'water',
  reading: 'reading',
  photo: 'photo',
  notes: 'notes',
}

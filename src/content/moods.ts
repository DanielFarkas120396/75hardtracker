import type { DayEntry } from '../db/types'

export type Mood = NonNullable<DayEntry['mood']>

/** The five moods of "How was today?", worst to best. */
export const MOODS: { value: Mood; emoji: string; label: string }[] = [
  { value: 1, emoji: '😫', label: 'Rough' },
  { value: 2, emoji: '😕', label: 'Meh' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😄', label: 'Great' },
]

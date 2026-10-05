import { Icon } from '../../components/icons/Icon'
import { ACTIVITY_ICONS } from '../../content/activities'
import type { WorkoutType } from '../../db/types'
import { WORKOUT_TYPES } from '../../logic/constants'

interface ActivityPickerProps {
  value: WorkoutType
  onPick: (type: WorkoutType) => void
  /** The other logos' background, set against what's behind the row. */
  idleClassName?: string
}

/** The seven activities as logos; the chosen one is ringed in the workouts' orange. */
export function ActivityPicker({ value, onPick, idleClassName = 'bg-canvas' }: ActivityPickerProps) {
  return (
    <div role="group" aria-label="Activity" className="grid grid-cols-7 gap-0.5">
      {WORKOUT_TYPES.map((type) => {
        const selected = type === value
        return (
          <button
            key={type}
            type="button"
            aria-label={type}
            aria-pressed={selected}
            onClick={() => onPick(type)}
            className={`flex h-11 items-center justify-center rounded-xl motion-safe:transition-colors ${
              selected ? 'bg-orange-light text-orange-ink ring-2 ring-orange-ink' : `${idleClassName} text-ink-muted`
            }`}
          >
            <Icon name={ACTIVITY_ICONS[type]} size={26} strokeWidth={1.8} />
          </button>
        )
      })}
    </div>
  )
}

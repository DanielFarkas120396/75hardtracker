import { MOODS, type Mood } from '../content/moods'

interface MoodPickerProps {
  /** The group's accessible name. */
  label: string
  value: Mood | undefined
  /** The mood tapped; callers clear the value when it's the one already chosen. */
  onPick: (mood: Mood) => void
  /** The chosen mood's look, in its task's colour. */
  selectedClassName: string
  /** The other moods' background, set against what's behind the row. */
  idleClassName?: string
}

/** The five moods of "How was today?", worst to best, as emoji buttons. */
export function MoodPicker({ label, value, onPick, selectedClassName, idleClassName = 'bg-canvas' }: MoodPickerProps) {
  return (
    <div role="group" aria-label={label} className="grid grid-cols-5 gap-1">
      {MOODS.map((mood) => {
        const selected = value === mood.value
        return (
          <button
            key={mood.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onPick(mood.value)}
            className={`flex min-h-touch flex-col items-center justify-center rounded-2xl py-1 motion-safe:transition-transform ${
              selected ? `scale-105 ${selectedClassName}` : idleClassName
            }`}
          >
            <span className="text-2xl" aria-hidden="true">
              {mood.emoji}
            </span>
            <span className="text-[11px] font-bold text-ink-muted">{mood.label}</span>
          </button>
        )
      })}
    </div>
  )
}

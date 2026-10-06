import type { StartChoice, StartDateChoiceState } from '../hooks/useStartDateChoice'

const START_CHOICES: ReadonlyArray<{ id: StartChoice; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'pick', label: 'Pick a date' },
]

interface StartDateChoiceProps {
  /** From useStartDateChoice. */
  state: StartDateChoiceState
  today: string
  /** The id of the element that shows `state.dateError`, so the date field points at it. */
  errorId?: string
}

/** Today / Tomorrow / Pick a date, with a date field while picking. */
export function StartDateChoice({ state, today, errorId }: StartDateChoiceProps) {
  const invalid = state.dateError !== null
  return (
    <>
      <div role="radiogroup" aria-label="When to start" className="flex gap-1 rounded-2xl border border-ink/15 bg-canvas p-1">
        {START_CHOICES.map(({ id, label }) => {
          const selected = state.choice === id
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => state.setChoice(id)}
              className={`min-h-touch flex-1 rounded-xl px-2 font-rounded text-sm font-bold motion-safe:transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                selected ? 'bg-surface text-ink shadow-sm ring-1 ring-ink-muted' : 'text-ink-muted'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>

      {state.choice === 'pick' && (
        <input
          type="date"
          aria-label="Start date"
          min={today}
          max={state.maxDate}
          value={state.pickedDate}
          onChange={(e) => state.setPickedDate(e.target.value)}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid && errorId ? errorId : undefined}
          className="mt-2 min-h-touch w-full rounded-xl border border-ink/15 bg-canvas px-3 font-rounded font-bold text-ink aria-invalid:border-danger-ink"
        />
      )}
    </>
  )
}

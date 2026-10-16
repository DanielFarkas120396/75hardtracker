import { useLiveQuery } from 'dexie-react-hooks'
import { useId, useState } from 'react'
import { Icon } from '../../components/icons/Icon'
import { measurementRepo } from '../../db/repositories/measurementRepo'
import { validateMeasurement } from '../../logic/measurements'

interface WeighInCardProps {
  today: string
  dayNumber: number
}

/**
 * On Today, under the hero, until today's weight is logged. The field sits in
 * the card because iOS only raises the keyboard for a field the player taps.
 * It never counts toward the day.
 */
export function WeighInCard({ today, dayNumber }: WeighInCardProps) {
  // One query, so the card and its hint arrive together, and nothing shows while it loads.
  const state = useLiveQuery(
    async () => ({ weighedToday: (await measurementRepo.getByDate(today)) !== undefined, lastWeight: await measurementRepo.getLatestWeight() }),
    [today],
  )
  if (!state || state.weighedToday) return null
  return <WeighInForm today={today} dayNumber={dayNumber} lastWeight={state.lastWeight} />
}

function WeighInForm({ today, dayNumber, lastWeight }: WeighInCardProps & { lastWeight?: number }) {
  const [weight, setWeight] = useState('')
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const inputId = useId()
  const errorId = useId()

  const save = async () => {
    const result = validateMeasurement({ date: today, weight, body: {} }, today)
    if (!result.ok) {
      setError(result.errors.weight)
      return
    }
    setSaving(true)
    try {
      await measurementRepo.save(result.value)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mx-4 mb-4 rounded-card border-2 border-world bg-surface p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-world-soft text-world-ink">
          <Icon name="scale" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-rounded font-bold text-ink">Weigh in</h2>
          <p className="font-rounded text-sm text-ink-muted">
            {dayNumber === 1 ? 'Your starting weight.' : 'Before breakfast is best.'}
          </p>
        </div>
      </div>
      <form
        className="mt-3"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          Weight in kg
        </label>
        <div className="flex items-center gap-2">
          <input
            id={inputId}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder={lastWeight?.toFixed(1)}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className="min-h-touch w-full min-w-0 flex-1 rounded-xl bg-canvas px-3 font-rounded text-lg font-bold text-ink placeholder:text-ink-muted"
          />
          <span aria-hidden="true" className="font-rounded text-sm font-bold text-ink-muted">
            kg
          </span>
          <button
            type="submit"
            disabled={saving}
            className="min-h-touch shrink-0 rounded-full bg-world px-5 font-rounded text-sm font-semibold text-on-world active:scale-95 motion-safe:transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Save
          </button>
        </div>
        {error && (
          <p id={errorId} className="mt-1 font-rounded text-sm font-semibold text-danger-ink">
            {error}
          </p>
        )}
      </form>
    </section>
  )
}

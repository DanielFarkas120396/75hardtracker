import { useState } from 'react'
import { VariantPicker } from '../../components/VariantPicker'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { challengeRepo } from '../../db/repositories/challengeRepo'
import { addDaysISO, formatDisplayDate, isValidISODate } from '../../lib/dates'
import type { ChallengeVariant } from '../../logic/rulesets'

interface NewChallengeSheetProps {
  open: boolean
  onClose: () => void
  defaultVariant: ChallengeVariant
  today: string
}

type StartChoice = 'today' | 'tomorrow' | 'pick'

const START_CHOICES: ReadonlyArray<{ id: StartChoice; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'pick', label: 'Pick a date' },
]

/** "Start a new challenge": pick the next attempt's challenge, and when it begins. */
export function NewChallengeSheet(props: NewChallengeSheetProps) {
  return (
    <Modal open={props.open} onClose={props.onClose}>
      <NewChallengeForm {...props} />
    </Modal>
  )
}

/** Mounted each time the sheet opens, so the variant and start choice reset to their defaults. */
function NewChallengeForm({ defaultVariant, today, onClose }: NewChallengeSheetProps) {
  const [variant, setVariant] = useState<ChallengeVariant>(defaultVariant)
  const [choice, setChoice] = useState<StartChoice>('today')
  const [pickedDate, setPickedDate] = useState(today)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startDate = choice === 'today' ? today : choice === 'tomorrow' ? addDaysISO(today, 1) : pickedDate

  // ISO strings compare chronologically.
  const dateError = !isValidISODate(startDate)
    ? 'Pick a start date.'
    : startDate < today
      ? "The start can't be in the past."
      : null

  const start = async () => {
    if (dateError) return
    setBusy(true)
    setError(null)
    try {
      await challengeRepo.startNew(startDate, variant)
      onClose()
    } catch {
      setError("Couldn't start it — try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <h3 className="font-rounded text-lg font-extrabold text-ink">Start a new challenge</h3>

      <div className="mt-3">
        <VariantPicker value={variant} onChange={setVariant} />
      </div>

      <div role="radiogroup" aria-label="When to start" className="mt-3 flex gap-1 rounded-2xl bg-canvas p-1">
        {START_CHOICES.map(({ id, label }) => {
          const selected = choice === id
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setChoice(id)}
              className={`min-h-touch flex-1 rounded-xl px-2 font-rounded text-sm font-bold motion-safe:transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                selected ? 'bg-surface text-ink shadow-sm ring-1 ring-ink-muted' : 'text-ink-muted'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>

      {choice === 'pick' && (
        <input
          type="date"
          aria-label="Start date"
          min={today}
          value={pickedDate}
          onChange={(e) => setPickedDate(e.target.value)}
          className="mt-2 min-h-touch w-full rounded-xl bg-canvas px-3 font-rounded font-bold text-ink"
        />
      )}

      {!dateError && (
        <p className="mt-3 text-sm text-ink-muted">
          A new attempt starts on {formatDisplayDate(startDate)}. Every photo and stat from this one stays saved.
        </p>
      )}

      {(dateError ?? error) && (
        <p role="alert" className="mt-2 text-sm font-semibold text-danger-ink">
          {dateError ?? error}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <Button className="flex-1" onClick={() => void start()} disabled={busy || dateError !== null}>
          {busy ? 'Starting…' : 'Start'}
        </Button>
        <Button variant="secondary" className="flex-1" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
      </div>
    </>
  )
}

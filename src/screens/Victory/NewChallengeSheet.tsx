import { useState } from 'react'
import { StartDateChoice } from '../../components/StartDateChoice'
import { VariantPicker } from '../../components/VariantPicker'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { challengeRepo } from '../../db/repositories/challengeRepo'
import { formatDisplayDate } from '../../lib/dates'
import { useStartDateChoice } from '../../hooks/useStartDateChoice'
import type { ChallengeVariant } from '../../logic/rulesets'

interface NewChallengeSheetProps {
  open: boolean
  onClose: () => void
  defaultVariant: ChallengeVariant
  today: string
}

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
  const start = useStartDateChoice(today)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const begin = async () => {
    if (start.dateError) return
    setBusy(true)
    setError(null)
    try {
      await challengeRepo.startNew(start.startDate, variant)
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

      <div className="mt-3">
        <StartDateChoice state={start} today={today} errorId="new-challenge-error" />
      </div>

      {!start.dateError && (
        <p className="mt-3 text-sm text-ink-muted">
          A new attempt starts on {formatDisplayDate(start.startDate)}. Every photo and stat from this one stays saved.
        </p>
      )}

      {(start.dateError ?? error) && (
        <p id="new-challenge-error" role="alert" className="mt-2 text-sm font-semibold text-danger-ink">
          {start.dateError ?? error}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <Button className="flex-1" onClick={() => void begin()} disabled={busy || start.dateError !== null}>
          {busy ? 'Starting…' : 'Start'}
        </Button>
        <Button variant="secondary" className="flex-1" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
      </div>
    </>
  )
}

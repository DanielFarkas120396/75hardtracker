import { useState } from 'react'
import { Field } from '../../components/ui/Field'
import { EARLIEST_BEDTIME, isValidBedtime, LATEST_BEDTIME } from '../../logic/menace'

interface CompanionSectionProps {
  bedtime: string
  onBedtimeChange: (value: string) => Promise<void>
}

/** The duck's settings: the bedtime his menace counts down to. */
export function CompanionSection({ bedtime, onBedtimeChange }: CompanionSectionProps) {
  // A local draft, so an out-of-range time can be shown while it's being fixed.
  // It follows the saved value when that loads or changes; no remount,
  // because that would close the iOS time wheel mid-scroll.
  const [draft, setDraft] = useState(bedtime)
  const [previousBedtime, setPreviousBedtime] = useState(bedtime)
  if (bedtime !== previousBedtime) {
    setPreviousBedtime(bedtime)
    setDraft(bedtime)
  }
  const valid = isValidBedtime(draft)

  return (
    <section className="rounded-card bg-surface p-4 shadow-sm">
      <h2 className="font-rounded text-lg font-extrabold text-ink">🦆 Companion</h2>
      <Field label="Bedtime" error={valid ? undefined : `Pick a time between ${EARLIEST_BEDTIME} and ${LATEST_BEDTIME}.`}>
        <input
          type="time"
          min={EARLIEST_BEDTIME}
          max={LATEST_BEDTIME}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            if (isValidBedtime(e.target.value)) void onBedtimeChange(e.target.value)
          }}
          className="min-h-touch w-full rounded-xl bg-canvas px-3 font-rounded font-bold text-ink"
        />
      </Field>
      <p className="mt-2 text-sm text-ink-muted">
        The duck only gets menacing when what's left no longer fits before this time. Reading, the photo and the diet
        only count in the last half hour.
      </p>
    </section>
  )
}

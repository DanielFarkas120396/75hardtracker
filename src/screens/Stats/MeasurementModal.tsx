import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { measurementRepo } from '../../db/repositories/measurementRepo'
import type { Measurement } from '../../db/types'
import { formatDisplayDate } from '../../lib/dates'
import {
  BODY_MEASUREMENTS,
  validateMeasurement,
  type BodyMeasurement,
  type MeasurementErrors,
} from '../../logic/measurements'

const BODY_LABELS: Record<BodyMeasurement, string> = {
  waist: 'Waist',
  chest: 'Chest',
  hips: 'Hips',
  arms: 'Arms',
}

interface MeasurementModalProps {
  /** The weigh-in being edited, or `null` for a new one. */
  measurement: Measurement | null
  open: boolean
  today: string
  onClose: () => void
}

const numberText = (value: number | undefined) => (value === undefined ? '' : String(value))

/** Add or edit a weigh-in: date, weight in kg, and optional body measurements in cm. */
export function MeasurementModal({ measurement, open, today, onClose }: MeasurementModalProps) {
  return (
    <Modal open={open} onClose={onClose}>
      {/* Keyed so each open starts from the entry being edited (or a blank form). */}
      <MeasurementForm key={measurement?.id ?? 'new'} measurement={measurement} today={today} onDone={onClose} />
    </Modal>
  )
}

function MeasurementForm({
  measurement,
  today,
  onDone,
}: {
  measurement: Measurement | null
  today: string
  onDone: () => void
}) {
  const [date, setDate] = useState(measurement?.date ?? today)
  const [weight, setWeight] = useState(numberText(measurement?.weight_kg))
  const [body, setBody] = useState<Partial<Record<BodyMeasurement, string>>>(() =>
    Object.fromEntries(BODY_MEASUREMENTS.map((key) => [key, numberText(measurement?.bodyMeasurements_cm?.[key])])),
  )
  const [errors, setErrors] = useState<MeasurementErrors>({})
  const [saving, setSaving] = useState(false)

  const save = async () => {
    const result = validateMeasurement({ date, weight, body }, today)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setSaving(true)
    try {
      const saved = await measurementRepo.save(result.value, measurement?.id)
      if (!saved.ok) {
        setErrors({ date: `There's already a weigh-in on ${formatDisplayDate(date)} — edit that one instead.` })
        return
      }
      onDone()
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
      noValidate
    >
      <h3 className="font-rounded text-lg font-extrabold text-ink">
        {measurement ? 'Edit weigh-in' : 'Log a weigh-in'}
      </h3>

      <Field label="Date" error={errors.date}>
        <input
          type="date"
          value={date}
          max={today}
          onChange={(e) => setDate(e.target.value)}
          className="min-h-touch w-full rounded-xl bg-canvas px-3 font-rounded font-bold text-ink"
        />
      </Field>

      <Field label="Weight" unit="kg" error={errors.weight}>
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="82.5"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          className="min-h-touch w-full rounded-xl bg-canvas px-3 font-rounded text-lg font-extrabold text-ink"
        />
      </Field>

      <p className="mt-4 text-sm font-semibold text-ink-muted">Optional measurements (cm)</p>
      <div className="grid grid-cols-2 gap-x-3">
        {BODY_MEASUREMENTS.map((key) => (
          <Field key={key} label={BODY_LABELS[key]} unit="cm" error={errors[key]}>
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={body[key] ?? ''}
              onChange={(e) => setBody((current) => ({ ...current, [key]: e.target.value }))}
              className="min-h-touch w-full rounded-xl bg-canvas px-3 font-rounded font-bold text-ink"
            />
          </Field>
        ))}
      </div>

      <div className="mt-5 flex gap-2">
        <Button type="submit" variant="primary" className="flex-1" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" variant="secondary" className="flex-1" onClick={onDone} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

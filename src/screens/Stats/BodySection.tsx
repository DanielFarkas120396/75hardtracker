import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { measurementRepo } from '../../db/repositories/measurementRepo'
import type { Measurement } from '../../db/types'
import { formatDisplayDate } from '../../lib/dates'
import { BODY_MEASUREMENTS, weightSummary, type WeightPoint } from '../../logic/measurements'
import { MeasurementModal } from './MeasurementModal'
import { WeightChart } from './WeightChart'

/** Rows shown before "Show all". */
const COLLAPSED_ROWS = 5

interface BodySectionProps {
  today: string
}

function formatChange(changeKg: number): string {
  if (changeKg === 0) return '±0 kg'
  return `${changeKg > 0 ? '+' : '−'}${Math.abs(changeKg).toFixed(1)} kg`
}

function bodySummary(measurement: Measurement): string {
  const values = measurement.bodyMeasurements_cm ?? {}
  return BODY_MEASUREMENTS.filter((key) => values[key] !== undefined)
    .map((key) => `${key} ${values[key]}`)
    .join(' · ')
}

/** Weigh-ins: the latest weight and its change, a weight chart, and the full editable list (the chart's table view). */
export function BodySection({ today }: BodySectionProps) {
  const measurements = useLiveQuery(() => measurementRepo.getAll(), [])
  const [editing, setEditing] = useState<Measurement | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deleting, setDeleting] = useState<Measurement | null>(null)
  const [showAll, setShowAll] = useState(false)

  const points: WeightPoint[] = (measurements ?? [])
    .filter((m): m is Measurement & { weight_kg: number } => typeof m.weight_kg === 'number')
    .map((m) => ({ date: m.date, weight_kg: m.weight_kg }))
  const summary = weightSummary(points)
  const newestFirst = [...(measurements ?? [])].reverse()
  const rows = showAll ? newestFirst : newestFirst.slice(0, COLLAPSED_ROWS)

  const openForm = (measurement: Measurement | null) => {
    setEditing(measurement)
    setFormOpen(true)
  }

  return (
    <section className="rounded-card bg-surface p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-rounded text-lg font-extrabold text-ink">⚖️ Weight</h2>
        <Button variant="secondary" className="px-4 py-2" onClick={() => openForm(null)}>
          + Log
        </Button>
      </div>

      {summary ? (
        <p className="mt-2 font-rounded">
          <span className="text-3xl font-extrabold text-ink">{summary.latest.weight_kg.toFixed(1)} kg</span>
          {summary.changeKg !== undefined && summary.since && (
            <span className="ml-2 text-sm font-bold text-ink-muted">
              {formatChange(summary.changeKg)} since {formatDisplayDate(summary.since)}
            </span>
          )}
        </p>
      ) : (
        <p className="mt-2 text-sm text-ink-muted">
          No weigh-ins yet. Log your weight — and waist, chest, hips or arms if you like — to see your trend.
        </p>
      )}

      {points.length >= 2 ? (
        <WeightChart points={points} />
      ) : (
        summary && <p className="mt-2 text-sm text-ink-muted">Log another weigh-in to see your trend.</p>
      )}

      {rows.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {rows.map((m) => (
            <li key={m.id} className="flex items-center gap-2 rounded-2xl bg-canvas py-1 pr-1 pl-3">
              <button
                type="button"
                onClick={() => openForm(m)}
                className="min-h-touch flex-1 text-left"
                aria-label={`Edit weigh-in of ${formatDisplayDate(m.date)}`}
              >
                <span className="block font-rounded font-bold text-ink">
                  {m.weight_kg !== undefined ? `${m.weight_kg.toFixed(1)} kg` : '—'}
                  <span className="ml-2 text-xs font-semibold text-ink-muted">{formatDisplayDate(m.date)}</span>
                </span>
                {bodySummary(m) && <span className="block text-xs text-ink-muted">{bodySummary(m)} cm</span>}
              </button>
              <button
                type="button"
                onClick={() => setDeleting(m)}
                aria-label={`Delete weigh-in of ${formatDisplayDate(m.date)}`}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-ink-muted"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      {newestFirst.length > COLLAPSED_ROWS && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 min-h-touch w-full rounded-xl font-rounded text-sm font-bold text-ink-muted"
        >
          {showAll ? 'Show fewer' : `Show all ${newestFirst.length}`}
        </button>
      )}

      <MeasurementModal measurement={editing} open={formOpen} today={today} onClose={() => setFormOpen(false)} />

      <Modal open={deleting !== null} onClose={() => setDeleting(null)}>
        <h3 className="font-rounded text-lg font-extrabold text-ink">Delete this weigh-in?</h3>
        <p className="mt-2 text-sm text-ink-muted">
          {deleting && `${formatDisplayDate(deleting.date)} — this can't be undone.`}
        </p>
        <div className="mt-4 flex gap-2">
          <Button
            variant="danger"
            className="flex-1"
            onClick={() => {
              if (deleting) void measurementRepo.remove(deleting.id)
              setDeleting(null)
            }}
          >
            Delete
          </Button>
          <Button variant="secondary" className="flex-1" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
        </div>
      </Modal>
    </section>
  )
}

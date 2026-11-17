import { useLiveQuery } from 'dexie-react-hooks'
import { useId, useState } from 'react'
import { Icon } from '../../components/icons/Icon'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { measurementRepo } from '../../db/repositories/measurementRepo'
import type { Measurement } from '../../db/types'
import { formatDisplayDate } from '../../lib/dates'
import { format, parseISO } from 'date-fns'
import { attemptWeights, BODY_MEASUREMENTS, weightSummary, weightTrend } from '../../logic/measurements'
import { MeasurementModal } from './MeasurementModal'
import { WeightChart } from './WeightChart'

/** Rows shown before "Show all". */
const COLLAPSED_ROWS = 8

interface BodySectionProps {
  today: string
  /** The attempt's Day 1. */
  startDate: string
  /** The day the attempt has reached (1 to 75). */
  lastDay: number
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

/**
 * This attempt's weight: the latest and its change from the start, then the chart, big. The arrow
 * under it unfolds the weigh-ins, one compact row each (day, date, weight, change since the one
 * before); a row opens the weigh-in to edit or delete it.
 */
export function BodySection({ today, startDate, lastDay }: BodySectionProps) {
  const measurements = useLiveQuery(() => measurementRepo.getAll(), [])
  const [editing, setEditing] = useState<Measurement | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deleting, setDeleting] = useState<Measurement | null>(null)
  const [showAll, setShowAll] = useState(false)
  // Just the chart until the arrow is tapped. "+ Log" works either way.
  const [open, setOpen] = useState(false)
  const panelId = useId()

  const weighIns = attemptWeights(
    (measurements ?? []).filter((m): m is Measurement & { weight_kg: number } => typeof m.weight_kg === 'number'),
    startDate,
    lastDay,
  )
  const summary = weightSummary(weighIns)
  const newestFirst = [...weighIns].reverse()
  const rows = showAll ? newestFirst : newestFirst.slice(0, COLLAPSED_ROWS)

  const openForm = (measurement: Measurement | null) => {
    setEditing(measurement)
    setFormOpen(true)
  }

  return (
    <section className="rounded-card bg-surface px-4 pt-4 pb-1 ring-1 ring-ink/10 dark:ring-0">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-rounded text-lg font-bold text-ink">
          <Icon name="scale" className="shrink-0 text-world-ink" />
          Weight
        </h2>
        <Button variant="secondary" className="px-4 py-2" onClick={() => openForm(null)}>
          + Log
        </Button>
      </div>

      {summary ? (
        <p className="mt-2 flex flex-wrap items-baseline gap-x-1.5">
          <span className="font-display text-5xl leading-none font-bold tracking-wide text-ink">{summary.latest.weight_kg.toFixed(1)}</span>
          <span className="font-display text-2xl font-bold text-ink">kg</span>
          {summary.changeKg !== undefined && (
            <span className="ml-2 font-rounded text-sm font-bold text-ink-muted">
              {formatChange(summary.changeKg)} since Day {Math.max(1, summary.start.day)}
            </span>
          )}
        </p>
      ) : (
        <p className="mt-2 pb-3 text-sm text-ink-muted">
          No weigh-ins yet. Log your weight — and waist, chest, hips or arms if you like — to see your trend.
        </p>
      )}

      {weighIns.length >= 2 ? (
        <WeightChart points={weightTrend(weighIns)} lastDay={lastDay} />
      ) : (
        summary && <p className="mt-2 text-sm text-ink-muted">Log another weigh-in to see your trend.</p>
      )}

      {open && (
        <div id={panelId} className="mt-2">
          <ul>
            {rows.map((m, i) => {
              const before = newestFirst[i + 1]
              const change = before && Math.round((m.weight_kg - before.weight_kg) * 10) / 10
              return (
                <li key={m.id} className="border-t border-ink/10">
                  <button
                    type="button"
                    onClick={() => openForm(m)}
                    className="flex min-h-touch w-full items-center gap-3 px-0.5 text-left"
                    aria-label={`Edit weigh-in of ${formatDisplayDate(m.date)}`}
                  >
                    <span className="w-28 shrink-0 font-rounded text-xs font-semibold text-ink-muted">
                      {m.day === 0 ? 'Start' : `Day ${m.day}`} · {format(parseISO(m.date), 'd MMM')}
                    </span>
                    <span className="font-display text-xl font-bold tracking-wide text-ink">{m.weight_kg.toFixed(1)}</span>
                    <span className="ml-auto font-rounded text-xs font-bold text-ink-muted">
                      {change === undefined ? '' : change === 0 ? '±0' : `${change < 0 ? '▼' : '▲'} ${Math.abs(change).toFixed(1)}`}
                    </span>
                    <span className="flex w-4 justify-center text-world-ink">
                      {bodySummary(m) && <Icon name="ruler" size={14} />}
                    </span>
                    {bodySummary(m) && <span className="sr-only">{bodySummary(m)} cm</span>}
                  </button>
                </li>
              )
            })}
          </ul>
          {newestFirst.length > COLLAPSED_ROWS && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="min-h-touch w-full font-rounded text-sm font-bold text-ink-muted"
            >
              {showAll ? 'Show fewer' : `Show all ${newestFirst.length}`}
            </button>
          )}
        </div>
      )}

      {weighIns.length > 0 && (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          aria-label="Weigh-ins"
          onClick={() => setOpen((value) => !value)}
          className="mx-auto flex min-h-touch w-16 items-center justify-center text-ink-muted"
        >
          <Icon name="chevron" size={20} className={`motion-safe:transition-transform ${open ? '-rotate-90' : 'rotate-90'}`} />
        </button>
      )}

      <MeasurementModal
        measurement={editing}
        open={formOpen}
        today={today}
        onClose={() => setFormOpen(false)}
        onDelete={() => {
          setFormOpen(false)
          setDeleting(editing)
        }}
      />

      <Modal open={deleting !== null} onClose={() => setDeleting(null)}>
        <h3 className="font-rounded text-lg font-bold text-ink">Delete this weigh-in?</h3>
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

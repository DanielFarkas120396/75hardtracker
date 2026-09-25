import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { TASK_NAMES } from '../../content/microcopy'
import type { ChallengeStatus } from '../../db/types'
import { useAttemptSummaries, type AttemptRecord } from '../../hooks/useAttemptSummaries'
import { useGalleryPhotos } from '../../hooks/useGalleryPhotos'
import { dateForDayNumber, formatDisplayDate } from '../../lib/dates'
import { attemptDayRows, type AttemptDayRow, type AttemptSummary } from '../../logic/attempts'
import { PhotoLightbox } from '../Gallery/PhotoLightbox'
import { PhotoThumbnail } from '../Gallery/PhotoThumbnail'

const STATUS_STYLES: Record<ChallengeStatus, string> = {
  active: 'bg-green-light text-green',
  completed: 'bg-yellow-light text-yellow-dark',
  failed: 'bg-danger/10 text-danger-dark',
}

interface AttemptHistorySectionProps {
  today: string
}

/** Every attempt with how far it got; tapping one opens its days and photos. */
export function AttemptHistorySection({ today }: AttemptHistorySectionProps) {
  const attempts = useAttemptSummaries(today)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const selected = attempts?.find((a) => a.challenge.id === selectedId)

  const openDetail = (challengeId: number) => {
    setSelectedId(challengeId)
    setDetailOpen(true)
  }

  return (
    <section className="rounded-card bg-surface p-4 shadow-sm">
      <h2 className="font-rounded text-lg font-extrabold text-ink">Attempt history</h2>
      <p className="mt-1 text-sm text-ink-muted">Tap an attempt to see its days and photos.</p>

      <ul className="mt-3 flex flex-col gap-2">
        {(attempts ?? []).map(({ challenge, summary }) => (
          <li key={challenge.id}>
            <button
              type="button"
              onClick={() => openDetail(challenge.id)}
              className="flex min-h-touch w-full items-center justify-between gap-3 rounded-2xl bg-canvas px-3 py-2 text-left"
            >
              <span>
                <span className="block font-rounded font-bold text-ink">
                  Attempt #{challenge.attemptNumber} · {progressLabel(challenge.status, summary)}
                </span>
                <span className="block text-xs text-ink-muted">
                  {dateRangeLabel(summary)} · {summary.xp} XP
                </span>
              </span>
              <StatusChip status={challenge.status} />
            </button>
          </li>
        ))}
      </ul>

      {/* Stays mounted after closing so the modal can animate out; keyed so each attempt starts fresh. */}
      {selected && (
        <AttemptDetail
          key={selected.challenge.id}
          attempt={selected}
          open={detailOpen}
          onClose={() => setDetailOpen(false)}
        />
      )}
    </section>
  )
}

function progressLabel(status: ChallengeStatus, summary: AttemptSummary): string {
  if (status !== 'active') return `Reached Day ${summary.reachedDay}`
  return summary.reachedDay >= 1 ? `On Day ${summary.reachedDay}` : 'Not started yet'
}

function dateRangeLabel(summary: AttemptSummary): string {
  const start = formatDisplayDate(summary.startDate)
  if (summary.endDate) return `${start} – ${formatDisplayDate(summary.endDate)}`
  return summary.reachedDay >= 1 ? `Since ${start}` : `Starts ${start}`
}

function StatusChip({ status }: { status: ChallengeStatus }) {
  return (
    <span className={`shrink-0 rounded-full px-3 py-1 font-rounded text-xs font-bold capitalize ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  )
}

/** One attempt's days (✓ runs, and what each other day missed) and its photos. */
function AttemptDetail({ attempt, open, onClose }: { attempt: AttemptRecord; open: boolean; onClose: () => void }) {
  const { challenge, summary, days } = attempt
  const photos = useGalleryPhotos(challenge.id)
  const [photoIndex, setPhotoIndex] = useState<number | null>(null)
  const rows = attemptDayRows(days, summary.reachedDay)

  return (
    <>
      <Modal open={open} onClose={onClose}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-rounded text-lg font-extrabold text-ink">Attempt #{challenge.attemptNumber}</h3>
            <p className="text-sm text-ink-muted">{dateRangeLabel(summary)}</p>
          </div>
          <StatusChip status={challenge.status} />
        </div>

        <p className="mt-3 font-rounded font-bold text-ink">
          {progressLabel(challenge.status, summary)} · {summary.completedDays} perfect{' '}
          {summary.completedDays === 1 ? 'day' : 'days'} · {summary.xp} XP
        </p>

        <h4 className="mt-4 font-rounded font-extrabold text-ink">Days</h4>
        {rows.length === 0 ? (
          <p className="mt-1 text-sm text-ink-muted">Nothing to show until Day 1.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1.5">
            {rows.map((row) => (
              <DayRow
                key={row.kind === 'complete' ? row.fromDay : row.dayNumber}
                row={row}
                startDate={challenge.startDate}
                // The running attempt's current day isn't missed yet — it's in progress.
                inProgress={challenge.status === 'active' && row.kind === 'incomplete' && row.dayNumber === summary.reachedDay}
              />
            ))}
          </ul>
        )}

        <h4 className="mt-4 font-rounded font-extrabold text-ink">Photos</h4>
        {photos && photos.length > 0 ? (
          <div className="mt-2 grid grid-cols-3 gap-2">
            {photos.map((entry, i) => (
              <PhotoThumbnail key={entry.photo.id} entry={entry} onClick={() => setPhotoIndex(i)} />
            ))}
          </div>
        ) : (
          photos && <p className="mt-1 text-sm text-ink-muted">No photos in this attempt.</p>
        )}

        <Button variant="secondary" className="mt-5 w-full" onClick={onClose}>
          Close
        </Button>
      </Modal>

      {/* Outside the Modal: its animated panel would trap a fixed-position overlay. */}
      <PhotoLightbox
        entries={photos ?? []}
        index={photoIndex}
        onClose={() => setPhotoIndex(null)}
        onNavigate={setPhotoIndex}
      />
    </>
  )
}

function DayRow({ row, startDate, inProgress }: { row: AttemptDayRow; startDate: string; inProgress: boolean }) {
  const dateOf = (dayNumber: number) => formatDisplayDate(dateForDayNumber(startDate, dayNumber))

  if (row.kind === 'complete') {
    const single = row.fromDay === row.toDay
    return (
      <li className="flex gap-2 text-sm">
        <span aria-hidden="true" className="font-extrabold text-green-dark">
          ✓
        </span>
        <span>
          <span className="font-bold text-ink">{single ? `Day ${row.fromDay}` : `Days ${row.fromDay}–${row.toDay}`}</span>
          <span className="text-ink-muted">
            {' '}
            · {single ? dateOf(row.fromDay) : `${dateOf(row.fromDay)} – ${dateOf(row.toDay)}`} · all done
          </span>
        </span>
      </li>
    )
  }

  const missed = row.missing.map((task) => TASK_NAMES[task]).join(', ')
  return (
    <li className="flex gap-2 text-sm">
      <span aria-hidden="true" className={inProgress ? 'font-extrabold text-ink-muted' : 'font-extrabold text-danger-dark'}>
        {inProgress ? '…' : '✗'}
      </span>
      <span>
        <span className="font-bold text-ink">Day {row.dayNumber}</span>
        <span className="text-ink-muted">
          {' '}
          · {dateOf(row.dayNumber)} {inProgress ? `(today) · to go: ${missed}` : `· missed ${missed}`}
        </span>
      </span>
    </li>
  )
}

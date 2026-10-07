import { useDragControls } from 'framer-motion'
import { createPortal } from 'react-dom'
import { BlobImage } from '../../components/BlobImage'
import { Icon } from '../../components/icons/Icon'
import { Modal } from '../../components/ui/Modal'
import { ACTIVITY_ICONS, formatMinutes } from '../../content/activities'
import type { DayEntry } from '../../db/types'
import { useEntryPhoto } from '../../hooks/useEntryPhoto'
import { useWorkoutsForEntry } from '../../hooks/useWorkoutsForEntry'
import { formatShortDay } from '../../lib/dates'

export interface OpenDay {
  dayNumber: number
  date: string
  /** The day's entry; none on a day nothing was logged (a joker can forgive one). */
  entry?: DayEntry
  /** The stone's centre on screen: the card grows out of it and shrinks back into it. */
  from: { x: number; y: number }
}

interface DayCardProps {
  /** The day shown; kept while the card closes, so it can shrink back with its content. */
  day: OpenDay | null
  open: boolean
  onClose: () => void
}

/** A past day on the Journey: its photo, its notes and its workouts. */
export function DayCard({ day, open, onClose }: DayCardProps) {
  const dragControls = useDragControls()

  // Portalled: a stacking context in the page would otherwise trap the card under the bottom nav.
  return createPortal(
    <Modal open={open && day !== null} onClose={onClose} from={day?.from} dragControls={dragControls} labelledBy="day-card-title">
      {day && (
        <>
          {/* The top of the card is its handle: drag it down to close. */}
          <div
            className="-mx-6 -mt-6 flex cursor-grab touch-none items-center justify-between px-6 pt-4 pb-1"
            onPointerDown={(e) => dragControls.start(e)}
          >
            <h2 id="day-card-title" className="font-display text-2xl leading-none tracking-wide text-ink">
              Day {day.dayNumber} <span className="text-base text-ink-muted">· {formatShortDay(day.date)}</span>
            </h2>
            <button
              type="button"
              aria-label="Close"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onClose}
              className="-mr-3 flex min-h-touch min-w-touch items-center justify-center text-ink-muted"
            >
              <Icon name="close" size={22} />
            </button>
          </div>

          {day.entry ? <DayDetails entry={day.entry} /> : <p className="mt-3 text-sm text-ink-muted">Nothing was logged this day.</p>}
        </>
      )}
    </Modal>,
    document.body,
  )
}

function DayDetails({ entry }: { entry: DayEntry }) {
  const photo = useEntryPhoto(entry.photoId)
  const workouts = useWorkoutsForEntry(entry.id) ?? []
  const notes = entry.notes?.trim()

  return (
    <>
      {photo ? (
        <BlobImage blob={photo.blob} alt={`Progress photo, Day ${entry.dayNumber}`} className="mt-3 h-[30dvh] w-full rounded-2xl object-cover" />
      ) : (
        // While the photo loads, the same box stays empty.
        <div className="mt-3 flex h-20 items-center justify-center gap-2 rounded-2xl bg-canvas text-sm text-ink-muted">
          {entry.photoId == null && (
            <>
              <Icon name="photo" size={18} /> No photo this day
            </>
          )}
        </div>
      )}

      {notes ? (
        <p className="mt-3 font-quote text-base leading-relaxed text-ink">{notes}</p>
      ) : (
        <p className="mt-3 text-sm text-ink-muted">No notes</p>
      )}

      {workouts.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Workouts">
          {workouts.map((workout) => (
            <li key={workout.id} className="flex items-center gap-1.5 rounded-xl bg-canvas px-3 py-2 font-rounded text-sm font-bold text-ink">
              <Icon name={ACTIVITY_ICONS[workout.type]} size={18} label={workout.type} className="text-world-ink" />
              {formatMinutes(workout.durationMin)}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

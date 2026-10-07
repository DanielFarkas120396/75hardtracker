import { useDragControls } from 'framer-motion'
import { useLiveQuery } from 'dexie-react-hooks'
import { BlobImage } from '../../components/BlobImage'
import { BookCover } from '../../components/BookCover'
import { Icon } from '../../components/icons/Icon'
import { Modal } from '../../components/ui/Modal'
import { ACTIVITY_ICONS, formatMinutes } from '../../content/activities'
import { MOODS } from '../../content/moods'
import { bookRepo } from '../../db/repositories/bookRepo'
import { dayEntryRepo } from '../../db/repositories/dayEntryRepo'
import type { DayEntry } from '../../db/types'
import { useCurrentBook } from '../../hooks/useCurrentBook'
import { useEntryPhoto } from '../../hooks/useEntryPhoto'
import { useWorkoutsForEntry } from '../../hooks/useWorkoutsForEntry'
import { formatShortDay } from '../../lib/dates'
import { CHALLENGE_LENGTH } from '../../logic/constants'
import { worldForDay } from './worlds'

export interface OpenDay {
  dayNumber: number
  date: string
  /** The day's entry; none on a day nothing was logged (a joker can forgive one). */
  entry?: DayEntry
  forgiven: boolean
  /** The stone's centre on screen: the card grows out of it and shrinks back into it. */
  from: { x: number; y: number }
}

interface DayCardProps {
  /** The day shown; kept while the card closes, so it can shrink back with its content. */
  day: OpenDay | null
  open: boolean
  onClose: () => void
}

/** A past day on the Journey: its photo and notes first, then its workouts and its book. */
export function DayCard({ day, open, onClose }: DayCardProps) {
  const dragControls = useDragControls()

  return (
    <Modal open={open && day !== null} onClose={onClose} from={day?.from} dragControls={dragControls} labelledBy="day-card-title">
      {day && (
        <>
          {/* The top of the card is its handle: drag it down to close. */}
          <div className="-mx-6 -mt-6 cursor-grab touch-none px-6 pt-3" onPointerDown={(e) => dragControls.start(e)}>
            <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-ink/20" />
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-rounded text-xs font-bold tracking-wider text-world-ink uppercase">
                  {worldForDay(day.dayNumber).name} · {formatShortDay(day.date)}
                </p>
                <h2 id="day-card-title" className="mt-1 font-display text-3xl leading-none tracking-wide text-ink">
                  Day {day.dayNumber} <span className="text-lg text-ink-muted">of {CHALLENGE_LENGTH}</span>
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={onClose}
                className="-mr-2 flex min-h-touch min-w-touch items-center justify-center text-ink-muted"
              >
                <Icon name="close" size={22} />
              </button>
            </div>
          </div>

          {day.forgiven && (
            <p className="mt-3 flex items-center gap-2 font-rounded text-sm font-bold text-world-ink">
              <Icon name="joker" size={18} /> Forgiven by a joker
            </p>
          )}

          {day.entry ? <DayDetails entry={day.entry} /> : <p className="mt-4 text-sm text-ink-muted">Nothing was logged this day.</p>}
        </>
      )}
    </Modal>
  )
}

function DayDetails({ entry }: { entry: DayEntry }) {
  const photo = useEntryPhoto(entry.photoId)
  const workouts = useWorkoutsForEntry(entry.id) ?? []
  const mood = MOODS.find((m) => m.value === entry.mood)
  const notes = entry.notes?.trim()

  return (
    <>
      {photo ? (
        <BlobImage blob={photo.blob} alt={`Progress photo, Day ${entry.dayNumber}`} className="mt-4 max-h-[34dvh] w-full rounded-2xl object-cover" />
      ) : (
        // While the photo loads, the same box stays empty.
        <div className="mt-4 flex h-28 items-center justify-center gap-2 rounded-2xl bg-canvas text-sm text-ink-muted">
          {entry.photoId == null && (
            <>
              <Icon name="photo" size={18} /> No photo this day
            </>
          )}
        </div>
      )}

      {notes || mood ? (
        <p className="mt-4 font-quote text-base leading-relaxed text-ink">
          {mood && (
            <span role="img" aria-label={mood.label} className="mr-2 not-italic">
              {mood.emoji}
            </span>
          )}
          {notes}
        </p>
      ) : (
        <p className="mt-4 text-sm text-ink-muted">No notes</p>
      )}

      {(workouts.length > 0 || entry.restDay) && (
        <section className="mt-5" aria-label="Workouts">
          <p className="text-xs font-bold text-ink-muted">Workouts</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {workouts.map((workout) => (
              <li key={workout.id} className="flex items-center gap-1.5 rounded-xl bg-canvas px-3 py-2 font-rounded text-sm font-bold text-ink">
                <Icon name={ACTIVITY_ICONS[workout.type]} size={18} label={workout.type} className="text-world-ink" />
                {formatMinutes(workout.durationMin)}
              </li>
            ))}
            {entry.restDay && <li className="rounded-xl bg-canvas px-3 py-2 font-rounded text-sm font-bold text-ink">Rest day</li>}
          </ul>
        </section>
      )}

      <DayBook entry={entry} />
    </>
  )
}

/** The book read that day, its cover and the pages; a day from before books were recorded lets you choose it. */
function DayBook({ entry }: { entry: DayEntry }) {
  const { books } = useCurrentBook()
  const book = useLiveQuery(async () => (entry.bookId == null ? undefined : bookRepo.getById(entry.bookId)), [entry.bookId])
  if (!book && books.length === 0 && entry.pages_read === 0) return null
  const pages = `${entry.pages_read} ${entry.pages_read === 1 ? 'page' : 'pages'}`

  return (
    <section className="mt-5" aria-label="Reading">
      <p className="text-xs font-bold text-ink-muted">Reading</p>
      {book ? (
        <div className="mt-2 flex items-center gap-3">
          <BookCover book={book} />
          <div>
            <p className="font-rounded font-bold text-ink">{book.title}</p>
            <p className="text-sm text-ink-muted">{pages}</p>
          </div>
        </div>
      ) : (
        <div className="mt-2">
          <p className="font-rounded font-bold text-ink">{pages}</p>
          {books.length > 0 && (
            <select
              value=""
              onChange={(e) => void dayEntryRepo.setBook(entry.id, Number(e.target.value))}
              aria-label="Choose the book"
              className="mt-2 min-h-touch w-full rounded-xl bg-canvas px-3 font-rounded text-base font-bold text-ink"
            >
              <option value="" disabled>
                Choose the book…
              </option>
              {books.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
    </section>
  )
}

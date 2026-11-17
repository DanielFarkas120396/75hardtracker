import type { MouseEvent } from 'react'
import { BlobImage } from '../../components/BlobImage'
import { Icon } from '../../components/icons/Icon'
import { ACTIVITY_ICONS, formatMinutes } from '../../content/activities'
import type { DayEntry } from '../../db/types'
import { useEntryPhoto } from '../../hooks/useEntryPhoto'
import { useWorkoutsForEntry } from '../../hooks/useWorkoutsForEntry'
import { formatShortDay } from '../../lib/dates'
import type { DayStatus } from './chapters'
import type { WorldId } from './worlds'

interface DayRowProps {
  dayNumber: number
  date: string
  status: DayStatus
  world: WorldId
  entry?: DayEntry
  /** Opens the day's card, from the point tapped. */
  onOpen: (from: { x: number; y: number }) => void
}

/** One day in the logbook: its photo, the first line of its notes, its workouts. */
export function DayRow({ dayNumber, date, status, world, entry, onOpen }: DayRowProps) {
  // A tap grows the card from the finger; the keyboard (no pointer position), from the row's middle.
  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (e.clientX || e.clientY) return onOpen({ x: e.clientX, y: e.clientY })
    const box = e.currentTarget.getBoundingClientRect()
    onOpen({ x: box.left + box.width / 2, y: box.top + box.height / 2 })
  }

  if (status === 'joker') {
    return (
      <button
        type="button"
        data-world={world}
        data-log-day={dayNumber}
        onClick={onClick}
        className="flex w-full items-center justify-between rounded-2xl border border-dashed border-ink/20 px-4 py-3 text-left font-rounded text-sm text-ink-muted"
      >
        <span>Day {dayNumber} · forgiven with a joker</span>
        <span aria-hidden="true">🃏</span>
      </button>
    )
  }

  const today = status === 'today'
  const subtitle = today ? (entry?.completed ? 'Done' : 'In progress') : status === 'restored' ? 'Not in your backup' : status === 'open' ? 'Not finished' : formatShortDay(date)

  return (
    <button
      type="button"
      data-world={world}
      data-log-day={dayNumber}
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-card p-2.5 text-left motion-safe:transition-transform active:scale-[0.98] ${
        // A faint wash of the world's colour from the photo side, so each chapter reads as its world.
        today
          ? 'bg-world-soft ring-2 ring-world'
          : 'bg-linear-to-r from-[color-mix(in_srgb,var(--color-world)_14%,var(--color-surface))] to-[color-mix(in_srgb,var(--color-world)_4%,var(--color-surface))]'
      }`}
    >
      <Thumbnail photoId={entry?.photoId} dayNumber={dayNumber} />
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg leading-none font-semibold tracking-wide text-world-ink uppercase">
          {today ? `Today · Day ${dayNumber}` : `Day ${dayNumber}`}
        </p>
        <p className="mt-1 font-rounded text-xs text-ink-muted">{today ? `${formatShortDay(date)} · ${subtitle}` : subtitle}</p>
        {entry && <Details entry={entry} />}
      </div>
    </button>
  )
}

function Thumbnail({ photoId, dayNumber }: { photoId?: number; dayNumber: number }) {
  const photo = useEntryPhoto(photoId)
  return (
    <div className="flex h-[4.5rem] w-14 flex-none items-center justify-center overflow-hidden rounded-xl bg-canvas text-ink-muted">
      {photo ? (
        <BlobImage blob={photo.blob} alt={`Progress photo, Day ${dayNumber}`} loading="lazy" decoding="async" className="h-full w-full object-cover" />
      ) : (
        photoId == null && <Icon name="photo" size={20} />
      )}
    </div>
  )
}

function Details({ entry }: { entry: DayEntry }) {
  const workouts = useWorkoutsForEntry(entry.id) ?? []
  const firstLine = entry.notes?.trim().split('\n')[0]

  return (
    <>
      {firstLine && <p className="mt-1 truncate font-rounded text-sm text-ink">{firstLine}</p>}
      {workouts.length > 0 && (
        <ul className="mt-1.5 flex flex-wrap gap-1" aria-label="Workouts">
          {workouts.map((workout) => (
            <li
              key={workout.id}
              className="flex items-center gap-1 rounded-full bg-world/15 px-2 py-0.5 font-rounded text-xs font-semibold text-world-ink"
            >
              <Icon name={ACTIVITY_ICONS[workout.type]} size={14} label={workout.type} />
              {formatMinutes(workout.durationMin)}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useId, useState } from 'react'
import { Icon } from '../../components/icons/Icon'
import { ACTIVITY_ICONS, formatMinutes } from '../../content/activities'
import { MOODS, type Mood } from '../../content/moods'
import { useWorkoutHistory } from '../../hooks/useWorkoutHistory'
import { formatShortDay } from '../../lib/dates'
import type { WorkoutType } from '../../logic/types'
import type { ActivityHistory, WorkoutHistory } from '../../logic/workoutHistory'

const sessionsWord = (count: number) => (count === 1 ? 'session' : 'sessions')
const moodFor = (feel: Mood) => MOODS.find((mood) => mood.value === feel)!

/** The translucent wash for the feel chips and the session list of an open card. */
const WASH = 'bg-white/55 dark:bg-black/25'

/** Every workout of the attempt, on Stats under Weight: a card per activity, stacked, all folded until one is tapped. */
export function WorkoutsSection({ challengeId }: { challengeId: number }) {
  const history = useWorkoutHistory(challengeId)
  const headingId = useId()
  const [open, setOpen] = useState<WorkoutType | null>(null)

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <h2 id={headingId} className="flex items-center gap-2 px-1 font-rounded text-lg font-bold text-ink">
        <Icon name="workout" className="shrink-0 text-world-ink" />
        Workouts
      </h2>
      {history &&
        (history.sessions === 0 ? (
          <div className="rounded-card bg-surface p-5 text-center ring-1 ring-ink/10 dark:ring-0">
            <h3 className="font-display text-xl tracking-wide text-ink">No workouts yet</h3>
            <p className="mt-1 font-rounded text-sm font-semibold text-ink-muted">Log your first one from Today.</p>
          </div>
        ) : (
          <>
            <Summary history={history} />
            <div>
              {history.activities.map((activity, i) => (
                <ActivityCard
                  key={activity.type}
                  activity={activity}
                  shade={history.activities.length > 1 ? i / (history.activities.length - 1) : 0}
                  open={activity.type === open}
                  onToggle={() => setOpen(activity.type === open ? null : activity.type)}
                />
              ))}
            </div>
          </>
        ))}
      {history && history.untried.length > 0 && <Untried types={history.untried} />}
    </section>
  )
}

function Summary({ history }: { history: WorkoutHistory }) {
  const tiles = [
    { value: `${history.sessions}`, label: sessionsWord(history.sessions) },
    { value: formatMinutes(history.minutes), label: 'of training' },
    { value: `${history.outdoors}`, label: 'outdoors' },
  ]
  return (
    <ul aria-label="This attempt" className="grid grid-cols-3 gap-2.5">
      {tiles.map((tile) => (
        <li key={tile.label} className="rounded-[1.25rem] bg-surface px-3.5 py-3 ring-1 ring-ink/10 dark:ring-0">
          <span className="block font-display text-xl leading-tight tracking-wide text-world-ink">{tile.value}</span>
          <span className="font-rounded text-xs font-bold text-ink-muted">{tile.label}</span>
        </li>
      ))}
    </ul>
  )
}

interface ActivityCardProps {
  activity: ActivityHistory
  /** Where its colour sits between the stack's strongest shade (0, the top) and its softest (1). */
  shade: number
  open: boolean
  onToggle: () => void
}

/**
 * One activity: a folder-like card drawn over the bottom of the one above, with its logo,
 * count and time. Tapped, it keeps its colour and unfolds its feels and sessions below them.
 */
function ActivityCard({ activity, shade, open, onToggle }: ActivityCardProps) {
  const { type, sessions, minutes, feels } = activity
  const panelId = useId()
  const reduceMotion = useReducedMotion()
  const count = sessions.length

  return (
    <section
      className="relative overflow-hidden rounded-[2rem] pb-10 text-on-stack shadow-[0_-6px_16px_rgba(0,0,0,0.1)] not-first:-mt-8"
      style={{ backgroundColor: `color-mix(in srgb, var(--color-stack-from), var(--color-stack-to) ${Math.round(shade * 100)}%)` }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={`${type}, ${count} ${sessionsWord(count)}`}
        onClick={onToggle}
        className="relative flex w-full items-center gap-4 px-5 pt-5 pb-2 text-left"
      >
        <Icon name={ACTIVITY_ICONS[type]} size={56} strokeWidth={1.5} className="shrink-0" />
        <span className="flex-1">
          <span className="block font-rounded text-lg font-bold">{type}</span>
          <span className="block font-display text-4xl leading-none tracking-wide">{count}</span>
          <span className="block font-rounded text-sm font-bold">
            {sessionsWord(count)} · {formatMinutes(minutes)}
          </span>
        </span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center self-start rounded-full">
          <Icon name="chevron" size={20} className={`motion-safe:transition-transform ${open ? '-rotate-90' : 'rotate-90'}`} />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-5 pt-2">
              {feels.length > 0 && (
                <ul aria-label="How it felt" className="flex flex-wrap gap-1.5">
                  {feels.map(({ feel, count: times }) => (
                    <li key={feel} className={`flex items-center gap-1 rounded-full py-0.5 pr-2.5 pl-1.5 font-rounded text-sm font-bold ${WASH}`}>
                      <span aria-hidden="true" className="text-lg">
                        {moodFor(feel).emoji}
                      </span>
                      <span className="sr-only">{moodFor(feel).label}: </span>
                      {times}
                    </li>
                  ))}
                </ul>
              )}

              <ol aria-label={`${type} sessions`} className={`mt-3 divide-y divide-current/15 rounded-[1.25rem] px-3.5 ${WASH}`}>
                {sessions.map((session) => (
                  <li key={session.id} className="flex items-center gap-2.5 py-2.5">
                    <span className="flex-1">
                      <span className="block font-rounded font-bold">Day {session.dayNumber}</span>
                      <span className="block font-rounded text-xs font-bold">{formatShortDay(session.date)}</span>
                    </span>
                    <span className="font-rounded text-sm font-bold">
                      {session.durationMin} min · {session.isOutdoor ? 'Outdoor' : 'Indoor'}
                    </span>
                    <span className="w-7 text-center text-xl">
                      {session.feel && (
                        <span role="img" aria-label={moodFor(session.feel).label}>
                          {moodFor(session.feel).emoji}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

function Untried({ types }: { types: readonly WorkoutType[] }) {
  return (
    <section>
      <h3 className="px-1 font-rounded text-xs font-bold tracking-wide text-ink-muted uppercase">Not tried yet</h3>
      <ul aria-label="Not tried yet" className="mt-2 flex flex-wrap gap-2">
        {types.map((type) => (
          <li
            key={type}
            className="flex items-center gap-2 rounded-full bg-surface py-1.5 pr-3.5 pl-2 font-rounded text-sm font-bold text-ink-muted ring-1 ring-ink/10 dark:ring-0"
          >
            <Icon name={ACTIVITY_ICONS[type]} size={24} strokeWidth={1.8} />
            {type}
          </li>
        ))}
      </ul>
    </section>
  )
}

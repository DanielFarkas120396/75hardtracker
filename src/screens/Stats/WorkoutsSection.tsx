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

const stackColor = (shade: number) => `color-mix(in srgb, var(--color-stack-from), var(--color-stack-to) ${Math.round(shade * 100)}%)`

/**
 * Every workout of the attempt, on Stats under Weight: the most practised activity as a full card,
 * the others as slim tabs tucked under it, most sessions first. A tapped card opens where it is.
 */
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
            <div className="flex flex-col">
              {history.activities.map((activity, i) => (
                <ActivityCard
                  key={activity.type}
                  activity={activity}
                  first={i === 0}
                  shade={history.activities.length > 1 ? i / (history.activities.length - 1) : 0}
                  layer={history.activities.length - i}
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
  /** The top card: always full size. The others are tabs until opened. */
  first: boolean
  /** Where its colour sits between the stack's strongest shade (0, the top) and its softest (1). */
  shade: number
  /** Its z-index: each card lies over the top of the next one. */
  layer: number
  open: boolean
  onToggle: () => void
}

/**
 * One activity, tucked under the card above it: the top one full size (logo, count, time), the others
 * slim tabs. Tapped, a card opens where it is, full size, and unfolds its feels and sessions.
 */
function ActivityCard({ activity, first, shade, layer, open, onToggle }: ActivityCardProps) {
  const { type, sessions, feels } = activity
  const panelId = useId()
  const reduceMotion = useReducedMotion()
  const count = sessions.length
  const full = first || open
  // A tucked card's top 24 px hide under the card above it, so its content starts lower.
  const top = first ? 'pt-5' : full ? 'pt-11' : 'pt-[2.125rem]'

  return (
    <section
      className="relative overflow-hidden rounded-[2rem] text-on-stack shadow-[0_6px_16px_rgba(0,0,0,0.25)] not-first:-mt-6"
      style={{ zIndex: layer, backgroundColor: stackColor(shade) }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={`${type}, ${count} ${sessionsWord(count)}`}
        onClick={onToggle}
        className={`relative flex w-full items-center text-left ${top} ${full ? 'gap-4 px-5 pb-5' : 'gap-3 px-[1.125rem] pb-2.5'}`}
      >
        {full ? <FullHeader activity={activity} open={open} /> : <TabHeader activity={activity} />}
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
            <div className="px-5 pb-5">
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

function FullHeader({ activity, open }: { activity: ActivityHistory; open: boolean }) {
  const count = activity.sessions.length
  return (
    <>
      <Icon name={ACTIVITY_ICONS[activity.type]} size={56} strokeWidth={1.5} className="shrink-0" />
      <span className="flex-1">
        <span className="block font-rounded text-lg font-bold">{activity.type}</span>
        <span className="block font-display text-4xl leading-none tracking-wide">{count}</span>
        <span className="block font-rounded text-sm font-bold">
          {sessionsWord(count)} · {formatMinutes(activity.minutes)}
        </span>
      </span>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center self-start rounded-full">
        <Icon name="chevron" size={20} className={`motion-safe:transition-transform ${open ? '-rotate-90' : 'rotate-90'}`} />
      </span>
    </>
  )
}

/** A tucked card: its logo, name, time and count on one line. */
function TabHeader({ activity }: { activity: ActivityHistory }) {
  return (
    <>
      <Icon name={ACTIVITY_ICONS[activity.type]} size={24} strokeWidth={1.8} className="shrink-0" />
      <span className="flex-1 truncate font-rounded font-bold">{activity.type}</span>
      <span className="font-rounded text-xs font-bold">{formatMinutes(activity.minutes)}</span>
      <span className="min-w-6 text-right font-display text-2xl leading-none tracking-wide">{activity.sessions.length}</span>
    </>
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

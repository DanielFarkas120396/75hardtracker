import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useId, useState, type CSSProperties } from 'react'
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

/** The favourite card's tiny sparks: fixed spots (no randomness), each with its own pace. */
const SPARKS = Array.from({ length: 16 }, (_, i) => ({
  left: ((i * 61 + 7) % 96) + 2,
  top: 30 + ((i * 43) % 70),
  size: 1 + (i % 2),
  opacity: 0.45 + ((i * 7) % 5) / 10,
  duration: 3 + ((i * 5) % 7) / 2,
  delay: (i * 0.7) % 6,
  dx: ((i * 13) % 25) - 12,
}))

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

/** The attempt's training in numbers, high on Stats: the time trained, big, then the sessions and how many were outdoors. Nothing before the first workout. */
export function WorkoutTotals({ challengeId }: { challengeId: number }) {
  const history = useWorkoutHistory(challengeId)
  return history && history.sessions > 0 ? <Summary history={history} /> : null
}

function Summary({ history }: { history: WorkoutHistory }) {
  const hours = Math.floor(history.minutes / 60)
  const minutes = history.minutes % 60
  return (
    <div role="group" aria-label="This attempt" className="flex items-center gap-4 px-1">
      <p>
        <span className="sr-only">{formatMinutes(history.minutes)}</span>
        <span aria-hidden="true" className="block font-display text-7xl leading-[0.9] font-bold tracking-wide text-world-ink">
          {hours > 0 ? (
            <>
              {hours}
              <span className="text-4xl">h</span>
              {String(minutes).padStart(2, '0')}
            </>
          ) : (
            <>
              {minutes}
              <span className="text-4xl">min</span>
            </>
          )}
        </span>
        <span className="mt-1 block font-quote text-base text-ink italic"> of sweat</span>
      </p>
      <span aria-hidden="true" className="w-px self-stretch bg-ink/15" />
      <div className="flex flex-col gap-2.5">
        <p>
          <span className="font-display text-4xl leading-none font-bold tracking-wide text-ink">{history.sessions}</span>{' '}
          <span className="font-rounded text-sm font-semibold text-ink-muted">{sessionsWord(history.sessions)}</span>
        </p>
        <p>
          <span className="font-display text-4xl leading-none font-bold tracking-wide text-ink">{history.outdoors}</span>{' '}
          <span className="font-quote text-sm text-ink italic">under the sky</span>
        </p>
      </div>
    </div>
  )
}

interface ActivityCardProps {
  activity: ActivityHistory
  /** The top card, the most practised activity: a little bigger, starred, glowing with sparks. */
  first: boolean
  /** Where its colour sits between the stack's strongest shade (0, the top) and its softest (1). */
  shade: number
  /** Its z-index: each card lies over the top of the next one. */
  layer: number
  open: boolean
  onToggle: () => void
}

/**
 * One activity, tucked under the card above it: its logo, name, time and count. Every card looks the same,
 * the top one starred. Tapped, a card unfolds its feels and sessions where it is.
 */
function ActivityCard({ activity, first, shade, layer, open, onToggle }: ActivityCardProps) {
  const { type, sessions, feels } = activity
  const panelId = useId()
  const reduceMotion = useReducedMotion()
  const count = sessions.length

  return (
    <section
      className="relative overflow-hidden rounded-[2rem] text-on-stack shadow-[0_6px_16px_rgba(0,0,0,0.25)] not-first:-mt-6"
      style={{ zIndex: layer, backgroundColor: stackColor(shade) }}
    >
      {first && <Embers />}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={`${type}, ${count} ${sessionsWord(count)}`}
        onClick={onToggle}
        // A tucked card's top 24 px hide under the card above it, so its content starts lower.
        className={`relative flex w-full items-center gap-3.5 px-5 text-left ${first ? 'py-7' : 'pt-9 pb-3'}`}
      >
        <Icon name={ACTIVITY_ICONS[type]} size={30} strokeWidth={1.8} className="shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-rounded text-lg leading-tight font-bold">{type}</span>
          <span className="flex items-center gap-1 font-rounded text-xs font-bold">
            {first && (
              <>
                <Icon name="star" size={14} strokeWidth={2} className="shrink-0" />
                Your favorite ·
              </>
            )}{' '}
            {formatMinutes(activity.minutes)}
          </span>
        </span>
        <span className="min-w-7 text-right font-display text-3xl leading-none tracking-wide">{count}</span>
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
            <div className="px-5 pb-4">
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

/** A warm glow rising from below the favourite card, with tiny sparks drifting up (still with "reduce motion"). */
function Embers() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0">
      <span className="absolute inset-0 bg-[radial-gradient(130%_90%_at_50%_120%,var(--color-stack-glow),transparent_70%)]" />
      {SPARKS.map((spark, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-[#ffd59a] shadow-[0_0_4px_1px_rgba(255,180,100,0.75)] motion-safe:animate-ember-rise"
          style={
            {
              left: `${spark.left}%`,
              top: `${spark.top}%`,
              width: spark.size,
              height: spark.size,
              opacity: spark.opacity,
              animationDuration: `${spark.duration}s`,
              animationDelay: `-${spark.delay}s`,
              '--spark-o': spark.opacity,
              '--spark-dx': `${spark.dx}px`,
            } as CSSProperties
          }
        />
      ))}
    </span>
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

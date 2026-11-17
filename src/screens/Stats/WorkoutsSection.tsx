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
 * Every workout of the attempt, on Stats under Weight: a wallet of cards. One activity in front
 * (most sessions at first), the others as slim tabs tucked under it, highest count first.
 */
export function WorkoutsSection({ challengeId }: { challengeId: number }) {
  const history = useWorkoutHistory(challengeId)
  const headingId = useId()
  const [front, setFront] = useState<WorkoutType | null>(null)
  const [open, setOpen] = useState(false)

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
            <Wallet
              activities={history.activities}
              front={front}
              open={open}
              onToggle={() => setOpen(!open)}
              onPick={(type) => {
                setFront(type)
                setOpen(false)
              }}
            />
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

interface WalletProps {
  activities: readonly ActivityHistory[]
  /** The activity in front; the first (most sessions) when null or no longer there. */
  front: WorkoutType | null
  open: boolean
  onToggle: () => void
  onPick: (type: WorkoutType) => void
}

/** The front card, then the other activities as tabs tucked under it, each narrower and softer than the last. */
function Wallet({ activities, front, open, onToggle, onPick }: WalletProps) {
  const reduceMotion = useReducedMotion()
  const frontCard = activities.find((activity) => activity.type === front) ?? activities[0]
  const tabs = activities.filter((activity) => activity !== frontCard)
  const slide = { duration: reduceMotion ? 0 : 0.35, ease: 'easeInOut' } as const

  return (
    <div className="flex flex-col">
      {/* Only the cards that change places fade in, not the whole stack when the page opens. */}
      <AnimatePresence initial={false}>
        <FrontCard key={frontCard.type} activity={frontCard} open={open} onToggle={onToggle} transition={slide} />
        {tabs.map((activity, i) => {
          const count = activity.sessions.length
          return (
            <motion.button
              key={activity.type}
              layout="position"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={slide}
              type="button"
              aria-label={`${activity.type}, ${count} ${sessionsWord(count)}`}
              onClick={() => onPick(activity.type)}
              className="relative -mt-6 flex items-center gap-3 rounded-[2rem] px-[1.125rem] pt-[2.125rem] pb-2.5 text-left text-on-stack shadow-[0_6px_16px_rgba(0,0,0,0.2)]"
              style={{
                // The inset stops growing after four tabs, so seven activities still fit a phone.
                marginInline: `${Math.min(i + 1, 4) * 10}px`,
                zIndex: tabs.length - i,
                backgroundColor: stackColor((i + 1) / tabs.length),
              }}
            >
              <Icon name={ACTIVITY_ICONS[activity.type]} size={24} strokeWidth={1.8} className="shrink-0" />
              <span className="flex-1 truncate font-rounded font-bold">{activity.type}</span>
              <span className="font-rounded text-xs font-bold">{formatMinutes(activity.minutes)}</span>
              <span className="min-w-6 text-right font-display text-2xl leading-none tracking-wide">{count}</span>
            </motion.button>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

interface FrontCardProps {
  activity: ActivityHistory
  open: boolean
  onToggle: () => void
  transition: { duration: number; ease: 'easeInOut' }
}

/** The activity in front: its logo, count and time. Tapped, it unfolds its feels and sessions below them. */
function FrontCard({ activity, open, onToggle, transition }: FrontCardProps) {
  const { type, sessions, minutes, feels } = activity
  const panelId = useId()
  const count = sessions.length

  return (
    <motion.section
      layout="position"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transition}
      className="relative overflow-hidden rounded-[2rem] text-on-stack shadow-[0_6px_16px_rgba(0,0,0,0.25)]"
      style={{ zIndex: 10, backgroundColor: stackColor(0) }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={`${type}, ${count} ${sessionsWord(count)}`}
        onClick={onToggle}
        className="relative flex w-full items-center gap-4 p-5 text-left"
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
            transition={transition}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5">
              {feels.length > 0 && (
                <ul aria-label="How it felt" className="flex flex-wrap gap-1.5">
                  {feels.map(({ feel, count: times }) => (
                    <li
                      key={feel}
                      className={`flex items-center gap-1 rounded-full py-0.5 pr-2.5 pl-1.5 font-rounded text-sm font-bold ${WASH}`}
                    >
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
    </motion.section>
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

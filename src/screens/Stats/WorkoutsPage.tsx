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

/** The translucent wash for chips and the session list on the open card. */
const WASH = 'bg-white/55 dark:bg-black/25'

interface WorkoutsPageProps {
  challengeId: number
  onBack: () => void
}

/** Every workout of the attempt: a card per activity, stacked, one open on its sessions. */
export function WorkoutsPage({ challengeId, onBack }: WorkoutsPageProps) {
  const history = useWorkoutHistory(challengeId)
  // undefined: the top card is open (the default); null: the player closed them all.
  const [chosen, setChosen] = useState<WorkoutType | null | undefined>(undefined)
  const open = chosen === undefined ? history?.activities[0]?.type : chosen

  return (
    <div className="min-h-dvh bg-canvas pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
      <header className="px-4 pt-4 pb-3">
        <button
          type="button"
          onClick={onBack}
          className="-ml-2 flex min-h-touch items-center gap-1 rounded-xl px-2 font-rounded font-bold text-world-ink"
        >
          <Icon name="chevron" size={18} className="rotate-180" />
          Stats
        </button>
        <h1 className="flex items-center gap-2 font-display text-2xl tracking-wide text-ink">
          <Icon name="workout" className="text-world-ink" />
          Workouts
        </h1>
      </header>

      {history && (
        <main className="flex flex-col gap-5 px-4">
          {history.sessions === 0 ? (
            <section className="rounded-card bg-surface p-5 text-center shadow-sm ring-1 ring-ink/10 dark:ring-0">
              <h2 className="font-display text-xl tracking-wide text-ink">No workouts yet</h2>
              <p className="mt-1 font-rounded text-sm font-semibold text-ink-muted">Log your first one from Today.</p>
            </section>
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
                    onToggle={() => setChosen(activity.type === open ? null : activity.type)}
                  />
                ))}
              </div>
            </>
          )}
          {history.untried.length > 0 && <Untried types={history.untried} />}
        </main>
      )}
    </div>
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
        <li key={tile.label} className="rounded-[1.25rem] bg-surface px-3.5 py-3 shadow-sm ring-1 ring-ink/10 dark:ring-0">
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
 * One activity: a folder-like card drawn over the bottom of the one above. Closed, its logo,
 * count and time; open, sky blue with the logo faint behind its feels, totals and sessions.
 */
function ActivityCard({ activity, shade, open, onToggle }: ActivityCardProps) {
  const { type, sessions, minutes, outdoors, feels } = activity
  const panelId = useId()
  const count = sessions.length

  return (
    <section
      className={`relative overflow-hidden rounded-[2rem] shadow-[0_-6px_16px_rgba(0,0,0,0.1)] not-first:-mt-8 motion-safe:transition-colors ${
        open ? 'bg-open-card text-on-open-card' : 'text-on-stack'
      }`}
      style={
        open
          ? undefined
          : { backgroundColor: `color-mix(in srgb, var(--color-stack-from), var(--color-stack-to) ${Math.round(shade * 100)}%)` }
      }
    >
      {open && (
        <Icon
          name={ACTIVITY_ICONS[type]}
          size={220}
          strokeWidth={1}
          className="pointer-events-none absolute -top-4 -right-12 opacity-15"
        />
      )}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={`${type}, ${count} ${sessionsWord(count)}`}
        onClick={onToggle}
        className={`relative flex w-full items-center gap-4 px-5 pt-5 text-left ${open ? 'pb-2' : 'pb-12'}`}
      >
        {!open && <Icon name={ACTIVITY_ICONS[type]} size={56} strokeWidth={1.5} className="shrink-0" />}
        {open ? (
          <span className="flex-1 font-rounded text-xl font-extrabold">{type}</span>
        ) : (
          <span className="flex-1">
            <span className="block font-rounded text-lg font-extrabold">{type}</span>
            <span className="block font-display text-4xl leading-none tracking-wide">{count}</span>
            <span className="block font-rounded text-sm font-extrabold">
              {sessionsWord(count)} · {formatMinutes(minutes)}
            </span>
          </span>
        )}
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center self-start rounded-full ${open ? WASH : ''}`}>
          <Icon name="chevron" size={20} className={open ? '-rotate-90' : 'rotate-90'} />
        </span>
      </button>

      {open && (
        <div id={panelId} className="relative px-5 pb-12">
          {feels.length > 0 && (
            <ul aria-label="How it felt" className="flex flex-wrap gap-1.5">
              {feels.map(({ feel, count: times }) => (
                <li key={feel} className={`flex items-center gap-1 rounded-full py-0.5 pr-2.5 pl-1.5 font-rounded text-sm font-extrabold ${WASH}`}>
                  <span aria-hidden="true" className="text-lg">
                    {moodFor(feel).emoji}
                  </span>
                  <span className="sr-only">{moodFor(feel).label}: </span>
                  {times}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex items-end gap-6">
            <p>
              <span className="block font-display text-6xl leading-[0.9] tracking-wide">{count}</span>
              <span className="font-rounded text-sm font-extrabold">{sessionsWord(count)}</span>
            </p>
            <p>
              <span className="block font-display text-2xl leading-none tracking-wide">{formatMinutes(minutes)}</span>
              <span className="font-rounded text-sm font-extrabold">in total</span>
            </p>
            <p>
              <span className="block font-display text-2xl leading-none tracking-wide">{outdoors}</span>
              <span className="font-rounded text-sm font-extrabold">outdoors</span>
            </p>
          </div>

          <ol aria-label={`${type} sessions`} className={`mt-4 divide-y divide-current/15 rounded-[1.25rem] px-3.5 ${WASH}`}>
            {sessions.map((session) => (
              <li key={session.id} className="flex items-center gap-2.5 py-2.5">
                <span className="flex-1">
                  <span className="block font-rounded font-extrabold">Day {session.dayNumber}</span>
                  <span className="block font-rounded text-xs font-bold">{formatShortDay(session.date)}</span>
                </span>
                <span className="font-rounded text-sm font-extrabold">
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
      )}
    </section>
  )
}

function Untried({ types }: { types: readonly WorkoutType[] }) {
  return (
    <section>
      <h2 className="px-1 font-rounded text-xs font-extrabold tracking-wide text-ink-muted uppercase">Not tried yet</h2>
      <ul aria-label="Not tried yet" className="mt-2 flex flex-wrap gap-2">
        {types.map((type) => (
          <li
            key={type}
            className="flex items-center gap-2 rounded-full bg-surface py-1.5 pr-3.5 pl-2 font-rounded text-sm font-bold text-ink-muted shadow-sm ring-1 ring-ink/10 dark:ring-0"
          >
            <Icon name={ACTIVITY_ICONS[type]} size={24} strokeWidth={1.8} />
            {type}
          </li>
        ))}
      </ul>
    </section>
  )
}

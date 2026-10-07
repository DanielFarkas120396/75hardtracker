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

const CARD = 'rounded-card bg-surface ring-1 ring-ink/10 dark:ring-0'
/** The translucent wash for chips and the session list on the open card. */
const WASH = 'bg-canvas/60'

/** Every workout of the attempt, on Stats under Weight: a row per activity, all closed until one is tapped. */
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
          <div className={`${CARD} p-5 text-center`}>
            <h3 className="font-display text-xl font-semibold tracking-wide text-ink">No workouts yet</h3>
            <p className="mt-1 font-rounded text-sm font-semibold text-ink-muted">Log your first one from Today.</p>
          </div>
        ) : (
          <>
            <Summary history={history} />
            <div className="flex flex-col gap-2.5">
              {history.activities.map((activity) => (
                <ActivityCard
                  key={activity.type}
                  activity={activity}
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
        <li key={tile.label} className={`${CARD} px-3.5 py-3`}>
          <span className="block font-display text-2xl leading-tight font-semibold tracking-wide text-world-ink">{tile.value}</span>
          <span className="font-rounded text-xs font-semibold text-ink-muted">{tile.label}</span>
        </li>
      ))}
    </ul>
  )
}

interface ActivityCardProps {
  activity: ActivityHistory
  open: boolean
  onToggle: () => void
}

/**
 * One activity. Closed, a row: the logo in a well of the world's tint, the name
 * and the time, the count on the right. Open, the row sits on the world's tint
 * with the logo faint behind its feels, totals and sessions.
 */
function ActivityCard({ activity, open, onToggle }: ActivityCardProps) {
  const { type, sessions, minutes, outdoors, feels } = activity
  const panelId = useId()
  const count = sessions.length

  return (
    <section className={`relative overflow-hidden rounded-card text-ink motion-safe:transition-colors ${open ? 'bg-world-soft' : CARD}`}>
      {open && (
        <Icon
          name={ACTIVITY_ICONS[type]}
          size={220}
          strokeWidth={1}
          className="pointer-events-none absolute -top-4 -right-12 text-world-ink opacity-15"
        />
      )}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={`${type}, ${count} ${sessionsWord(count)}`}
        onClick={onToggle}
        className="relative flex w-full items-center gap-3.5 px-4 py-3.5 text-left"
      >
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${open ? 'bg-surface/60' : 'bg-world-soft'} text-world-ink`}>
          <Icon name={ACTIVITY_ICONS[type]} size={28} strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-rounded text-base font-bold">{type}</span>
          <span className="block font-rounded text-sm font-semibold text-ink-muted">
            {open ? `${count} ${sessionsWord(count)}` : formatMinutes(minutes)}
          </span>
        </span>
        {!open && <span className="font-display text-3xl leading-none font-semibold tracking-wide">{count}</span>}
        <Icon name="chevron" size={20} className={`shrink-0 text-ink-muted ${open ? '-rotate-90' : 'rotate-90'}`} />
      </button>

      {open && (
        <div id={panelId} className="relative px-4 pb-4">
          {feels.length > 0 && (
            <ul aria-label="How it felt" className="flex flex-wrap gap-1.5">
              {feels.map(({ feel, count: times }) => (
                <li key={feel} className={`flex items-center gap-1 rounded-full py-0.5 pr-2.5 pl-1.5 font-rounded text-sm font-semibold ${WASH}`}>
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
              <span className="block font-display text-6xl leading-[0.9] font-semibold tracking-wide">{count}</span>
              <span className="font-rounded text-sm font-semibold text-ink-muted">{sessionsWord(count)}</span>
            </p>
            <p>
              <span className="block font-display text-2xl leading-none font-semibold tracking-wide">{formatMinutes(minutes)}</span>
              <span className="font-rounded text-sm font-semibold text-ink-muted">in total</span>
            </p>
            <p>
              <span className="block font-display text-2xl leading-none font-semibold tracking-wide">{outdoors}</span>
              <span className="font-rounded text-sm font-semibold text-ink-muted">outdoors</span>
            </p>
          </div>

          <ol aria-label={`${type} sessions`} className={`mt-4 divide-y divide-ink/10 rounded-xl2 px-3.5 ${WASH}`}>
            {sessions.map((session) => (
              <li key={session.id} className="flex items-center gap-2.5 py-2.5">
                <span className="flex-1">
                  <span className="block font-rounded font-bold">Day {session.dayNumber}</span>
                  <span className="block font-rounded text-xs font-semibold text-ink-muted">{formatShortDay(session.date)}</span>
                </span>
                <span className="font-rounded text-sm font-semibold">
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
      <h3 className="px-1 font-rounded text-xs font-bold tracking-wide text-ink-muted uppercase">Not tried yet</h3>
      <ul aria-label="Not tried yet" className="mt-2 flex flex-wrap gap-2">
        {types.map((type) => (
          <li
            key={type}
            className="flex items-center gap-2 rounded-full bg-surface py-1.5 pr-3.5 pl-2 font-rounded text-sm font-semibold text-ink-muted ring-1 ring-ink/10 dark:ring-0"
          >
            <Icon name={ACTIVITY_ICONS[type]} size={24} strokeWidth={1.8} />
            {type}
          </li>
        ))}
      </ul>
    </section>
  )
}

import { Icon } from '../../components/icons/Icon'
import { climbSegments } from '../../logic/climb'
import { CHALLENGE_LENGTH } from '../../logic/constants'
import { WORLDS, worldForDay } from '../Journey/worlds'

/** Each world's bar colour: its Journey stepping-stone face, the same in both themes. */
const STONE = Object.fromEntries(WORLDS.map((w) => [w.id, w.stone.face]))

/** The climb so far: the day reached, its world, and a bar split into the six worlds. */
export function ClimbCard({ dayReached }: { dayReached: number }) {
  const segments = climbSegments(dayReached)
  const day = Number.isFinite(dayReached) ? Math.min(CHALLENGE_LENGTH, Math.max(0, dayReached)) : 0
  const percent = Math.round((day / CHALLENGE_LENGTH) * 100)

  return (
    <section className="rounded-card bg-world-soft p-4">
      <p className="flex items-center gap-1 font-rounded text-sm font-bold text-world-ink">
        <Icon name="journey" size={16} />
        {day === 0 ? 'Not started yet' : worldForDay(day).name}
      </p>
      <p className="mt-1 font-display leading-none tracking-wide">
        <span className="text-4xl text-world-ink">Day {day}</span>{' '}
        <span className="text-lg text-ink-muted">of {CHALLENGE_LENGTH}</span>
      </p>

      <div role="img" aria-label={`${percent}% of the climb, through ${WORLDS.length} worlds`} className="mt-4 flex h-4 gap-1">
        {segments.map((segment) => (
          <div
            key={segment.id}
            className="relative h-full overflow-hidden rounded-full bg-surface"
            style={{ flexGrow: segment.share, flexBasis: 0 }}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full motion-safe:transition-[width] motion-safe:duration-700"
              style={{ width: `${segment.fill * 100}%`, backgroundColor: STONE[segment.id] }}
            />
          </div>
        ))}
      </div>
      <p className="mt-2 font-rounded text-xs font-bold text-ink-muted">{percent}% of the climb from Hell to Heaven</p>
    </section>
  )
}

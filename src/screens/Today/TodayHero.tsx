import { FlameStreak } from '../../components/FlameStreak'
import { Icon } from '../../components/icons/Icon'
import { ProgressRing } from '../../components/ui/ProgressRing'
import { worldProgressLine } from '../../content/worldLines'
import { useProfile } from '../../hooks/useProfile'
import { CHALLENGE_LENGTH } from '../../logic/constants'

interface TodayHeroProps {
  /** "75 Hard · Attempt #1". */
  attemptLine: string
  dayNumber: number
  completedCount: number
  taskCount: number
  streak: number
  /** Jokers left, or undefined when the ruleset has none. */
  jokersLeft: number | undefined
}

/**
 * The top of Today, in the world's colours and as short as it can be: the
 * day number with the ring of tasks done beside it, then one line with the
 * attempt, the streak and the jokers, where today is in its world, and the
 * player's reason. The duck below says hello.
 */
export function TodayHero({ attemptLine, dayNumber, completedCount, taskCount, streak, jokersLeft }: TodayHeroProps) {
  const profile = useProfile()

  return (
    <section className="mx-4 mt-3 mb-3 rounded-card bg-world-soft px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display leading-none tracking-wide">
            <span className="text-4xl text-world-ink">Day {dayNumber}</span>{' '}
            <span className="text-lg text-ink-muted">/ {CHALLENGE_LENGTH}</span>
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-rounded text-xs font-bold text-ink-muted">
            <span>{attemptLine}</span>
            <FlameStreak streak={streak} />
            {jokersLeft !== undefined && (
              <span className="flex items-center gap-1 text-orange-ink">
                <Icon name="joker" size={16} />
                {jokersLeft} {jokersLeft === 1 ? 'joker' : 'jokers'} left
              </span>
            )}
          </p>
          <p className="mt-1 flex items-center gap-1 font-rounded text-xs font-bold text-world-ink">
            <Icon name="journey" size={14} className="shrink-0" />
            {worldProgressLine(dayNumber)}
          </p>
          {profile && <p className="mt-1 truncate font-rounded text-xs italic text-ink-muted">“{profile.why}”</p>}
        </div>
        <ProgressRing value={completedCount} max={taskCount} size={68} strokeWidth={9} trackColor="var(--color-surface)">
          <span className="flex flex-col items-center leading-none">
            <span className="font-display text-lg tracking-wide text-ink">
              {completedCount}/{taskCount}
            </span>
            <span className="mt-0.5 font-rounded text-[0.5rem] font-extrabold uppercase text-ink-muted">tasks</span>
          </span>
        </ProgressRing>
      </div>
    </section>
  )
}

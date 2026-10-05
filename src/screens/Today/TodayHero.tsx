import { FlameStreak } from '../../components/FlameStreak'
import { Icon } from '../../components/icons/Icon'
import { Greeting } from '../../components/ProfileLines'
import { ProgressRing } from '../../components/ui/ProgressRing'
import { worldProgressLine } from '../../content/worldLines'
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
 * The top of Today, in the world's colours: the big day number, the ring of
 * tasks done, the streak, and how far today is through its world.
 */
export function TodayHero({ attemptLine, dayNumber, completedCount, taskCount, streak, jokersLeft }: TodayHeroProps) {
  return (
    <section className="mx-4 mt-6 mb-4 rounded-card bg-world-soft p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Greeting />
          <p className="font-rounded text-sm font-bold text-ink-muted">{attemptLine}</p>
          <h1 className="mt-1 font-display leading-none tracking-wide">
            <span className="text-5xl text-world-ink">Day {dayNumber}</span>{' '}
            <span className="text-xl text-ink-muted">/ {CHALLENGE_LENGTH}</span>
          </h1>
          <p className="mt-2 flex items-center gap-1 font-rounded text-sm font-bold text-world-ink">
            <Icon name="journey" size={16} className="shrink-0" />
            {worldProgressLine(dayNumber)}
          </p>
        </div>
        <ProgressRing value={completedCount} max={taskCount} size={92} strokeWidth={12} trackColor="var(--color-surface)">
          <span className="flex flex-col items-center leading-none">
            <span className="font-display text-2xl tracking-wide text-ink">
              {completedCount}/{taskCount}
            </span>
            <span className="mt-0.5 font-rounded text-[0.625rem] font-extrabold uppercase text-ink-muted">tasks</span>
          </span>
        </ProgressRing>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="flex h-9 items-center rounded-full bg-surface px-3">
          <FlameStreak streak={streak} />
        </span>
        {jokersLeft !== undefined && (
          <span className="flex h-9 items-center gap-1 rounded-full bg-surface px-3 font-rounded text-sm font-extrabold text-orange-ink">
            <Icon name="joker" size={18} />
            {jokersLeft} {jokersLeft === 1 ? 'joker' : 'jokers'} left
          </span>
        )}
      </div>
    </section>
  )
}

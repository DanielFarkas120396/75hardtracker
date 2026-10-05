import type { ReactNode } from 'react'
import { FlameStreak } from '../../components/FlameStreak'
import { Icon } from '../../components/icons/Icon'
import { ProgressRing } from '../../components/ui/ProgressRing'
import { worldProgressLine } from '../../content/worldLines'
import { useProfile } from '../../hooks/useProfile'
import { CHALLENGE_LENGTH } from '../../logic/constants'

interface TodayHeroProps {
  /** "75 Hard · #1". */
  attemptLine: string
  dayNumber: number
  completedCount: number
  taskCount: number
  streak: number
  /** Jokers left, or undefined when the ruleset has none. */
  jokersLeft: number | undefined
  /** The duck, in the top-left corner; his bubble floats over the summary. */
  duck?: ReactNode
  /** A small control under the ring: the plan button. */
  action?: ReactNode
}

/**
 * The top of Today, in the world's colours and as short as it can be: the
 * duck in the corner, the day number with the attempt, the streak and the
 * jokers, where today is in its world, and the player's reason; the ring
 * of tasks done on the right.
 */
export function TodayHero({ attemptLine, dayNumber, completedCount, taskCount, streak, jokersLeft, duck, action }: TodayHeroProps) {
  const profile = useProfile()

  return (
    <section className="relative mx-4 mt-3 mb-3 rounded-card bg-world-soft px-3 py-3">
      <div className="flex items-center gap-3">
        {duck}
        <div className="min-w-0 flex-1">
          <h1 className="font-display leading-none tracking-wide">
            <span className="text-4xl text-world-ink">Day {dayNumber}</span>{' '}
            <span className="text-lg text-ink-muted">/ {CHALLENGE_LENGTH}</span>
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-rounded text-xs font-bold text-ink-muted">
            <span>{attemptLine}</span>
            <FlameStreak streak={streak} />
            {jokersLeft !== undefined && (
              <span className="flex items-center gap-1 text-orange-ink">
                <Icon name="joker" size={16} />
                {jokersLeft} {jokersLeft === 1 ? 'joker' : 'jokers'} left
              </span>
            )}
          </div>
          <p className="mt-1 flex items-center gap-1 font-rounded text-xs font-bold text-world-ink">
            <Icon name="journey" size={14} className="shrink-0" />
            <span className="truncate">{worldProgressLine(dayNumber)}</span>
          </p>
          {profile && <p className="mt-1 truncate font-rounded text-xs italic text-ink-muted">“{profile.why}”</p>}
        </div>
        <div className="flex shrink-0 flex-col items-center gap-2">
          <ProgressRing value={completedCount} max={taskCount} size={60} strokeWidth={8} trackColor="var(--color-surface)">
            <span className="flex flex-col items-center leading-none">
              <span className="font-display text-base tracking-wide text-ink">
                {completedCount}/{taskCount}
              </span>
              <span className="mt-0.5 font-rounded text-[0.5rem] font-extrabold uppercase text-ink-muted">tasks</span>
            </span>
          </ProgressRing>
          {action}
        </div>
      </div>
    </section>
  )
}

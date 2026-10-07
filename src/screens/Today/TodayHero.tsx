import type { ReactNode } from 'react'
import { FlameStreak } from '../../components/FlameStreak'
import { Icon } from '../../components/icons/Icon'
import { ProgressRing } from '../../components/ui/ProgressRing'
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
  /** The duck, in the top-left corner. */
  duck?: ReactNode
  /** The duck's speech bubble: it pops up under him now and then, over the reason line. */
  speech?: ReactNode
  /** Late with tasks left: how long until midnight ("1h30 left"), under the ring. */
  countdown?: string | null
}

/**
 * The top of Today, in the world's colours: the duck in the corner, the day
 * number with the attempt, the streak and the jokers, the ring of tasks done
 * (and, late in the evening, the time left); then the player's reason. The
 * duck speaks in a bubble under himself, now and then.
 */
export function TodayHero({
  attemptLine,
  dayNumber,
  completedCount,
  taskCount,
  streak,
  jokersLeft,
  duck,
  speech,
  countdown,
}: TodayHeroProps) {
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
            {/* No streak yet on Day 1: a grey "0" flame says nothing. */}
            {streak > 0 && <FlameStreak streak={streak} />}
            {jokersLeft !== undefined && (
              <span className="flex items-center gap-1 text-orange-ink">
                <Icon name="joker" size={16} />
                {jokersLeft} {jokersLeft === 1 ? 'joker' : 'jokers'} left
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-center gap-1">
          <ProgressRing value={completedCount} max={taskCount} size={60} strokeWidth={8} trackColor="var(--color-surface)">
            <span
              role="img"
              aria-label={`${completedCount} of ${taskCount} tasks done`}
              className="font-display text-lg leading-none tracking-wide text-ink"
            >
              {completedCount}/{taskCount}
            </span>
          </ProgressRing>
          {countdown && <p className="font-rounded text-xs font-extrabold text-danger-ink">{countdown}</p>}
        </div>
      </div>
      {profile && <p className="mt-2 line-clamp-2 font-rounded text-xs italic text-ink-muted">“{profile.why}”</p>}
      {speech}
    </section>
  )
}

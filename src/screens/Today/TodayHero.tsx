import type { ReactNode } from 'react'
import { FlameStreak } from '../../components/FlameStreak'
import { Icon } from '../../components/icons/Icon'
import { ProgressRing } from '../../components/ui/ProgressRing'
import { useProfile } from '../../hooks/useProfile'
import { CHALLENGE_LENGTH } from '../../logic/constants'

/** The ring is the hero's centrepiece. */
const RING_SIZE = 132

interface TodayHeroProps {
  /** "75 Hard · #1". */
  attemptLine: string
  dayNumber: number
  completedCount: number
  taskCount: number
  streak: number
  /** Jokers left, or undefined when the ruleset has none. */
  jokersLeft: number | undefined
  /** The duck, at the bottom left beside the ring. */
  duck?: ReactNode
  /** The duck's speech bubble: it pops up above him now and then. */
  speech?: ReactNode
  /** Late with tasks left: how long until midnight ("1h30 left"), under the ring. */
  countdown?: string | null
}

/**
 * The top of Today, in the world's colours, built around the ring of tasks
 * done: the day, the attempt, the streak and the jokers on a line above it;
 * the duck beside it, talking upwards now and then; the time left under it
 * late in the evening; and the player's reason at the bottom.
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
    <section className="relative mx-4 mt-3 mb-3 rounded-card bg-world-soft px-3 pt-3 pb-3">
      <div className="flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1 text-center">
        <h1 className="font-display leading-none tracking-wide">
          <span className="text-2xl text-world-ink">Day {dayNumber}</span>{' '}
          <span className="text-base text-ink-muted">/ {CHALLENGE_LENGTH}</span>
        </h1>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-rounded text-xs font-bold text-ink-muted">
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

      {/* Three columns, so the ring sits in the true centre: the duck, the ring, and a spacer as wide as the duck. */}
      <div className="mt-3 grid grid-cols-[4.5rem_1fr_4.5rem] items-end">
        <div className="relative justify-self-start">
          {speech}
          {duck}
        </div>
        <div className="flex flex-col items-center gap-1">
          <ProgressRing value={completedCount} max={taskCount} size={RING_SIZE} strokeWidth={12} trackColor="var(--color-surface)">
            <span role="img" aria-label={`${completedCount} of ${taskCount} tasks done`} className="flex flex-col items-center leading-none">
              <span className="font-display text-4xl tracking-wide text-ink">
                {completedCount}/{taskCount}
              </span>
              <span aria-hidden="true" className="mt-1 font-rounded text-xs font-bold text-ink-muted">
                tasks done
              </span>
            </span>
          </ProgressRing>
          {countdown && <p className="font-rounded text-sm font-extrabold text-danger-ink">{countdown}</p>}
        </div>
        <span aria-hidden="true" />
      </div>

      {profile && <p className="mt-3 line-clamp-2 text-center font-rounded text-xs italic text-ink-muted">“{profile.why}”</p>}
    </section>
  )
}

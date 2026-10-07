import type { ReactNode } from 'react'
import { FlameStreak } from '../../components/FlameStreak'
import { Icon } from '../../components/icons/Icon'
import { GaugeRing } from '../../components/ui/GaugeRing'
import { useProfile } from '../../hooks/useProfile'

interface TodayHeroProps {
  /** "75 Hard #1". */
  attemptLine: string
  dayNumber: number
  completedCount: number
  taskCount: number
  streak: number
  /** Jokers left, or undefined when the ruleset has none. */
  jokersLeft: number | undefined
  /** The duck, at the bottom left beside the gauge. */
  duck?: ReactNode
  /** The duck's speech bubble: it pops up above him now and then. */
  speech?: ReactNode
  /** The "Day complete!" overlay is up: the gauge saves its finale for when it closes. */
  celebrating?: boolean
  /** Under the gauge: "Day N won" and the closing ritual, the time left late in the evening, or the next plan. */
  below?: ReactNode
}

/**
 * The top of Today, in the world's colours, built around the gauge of tasks
 * done: the day and the attempt on one line above it; the duck on its left,
 * talking upwards now and then; the streak and the jokers on its right; what
 * matters next under it; and the player's reason at the bottom.
 */
export function TodayHero({ attemptLine, dayNumber, completedCount, taskCount, streak, jokersLeft, duck, speech, below, celebrating = false }: TodayHeroProps) {
  const profile = useProfile()

  return (
    <section className="relative mx-4 mt-3 mb-3 rounded-card bg-world-soft px-3 pt-3 pb-3">
      {/* One line, never wrapping: the day, then the attempt. The 75 days are the Journey's to show. */}
      <h1 className="flex items-baseline justify-center gap-2 whitespace-nowrap text-center">
        <span className="font-display text-2xl leading-none tracking-wide text-world-ink">Day {dayNumber}</span>
        <span className="font-rounded text-xs font-bold text-ink-muted">{attemptLine}</span>
      </h1>

      {/* Three columns, so the gauge sits in the true centre: the duck, the gauge, the streak and jokers. */}
      <div className="mt-3 grid grid-cols-[4.5rem_1fr_4.5rem] items-end">
        <div className="relative justify-self-start">
          {speech}
          {duck}
        </div>
        <div className="flex flex-col items-center gap-1">
          <GaugeRing value={completedCount} max={taskCount} held={celebrating} />
          {below}
        </div>
        <div className="flex flex-col items-end gap-2 self-center font-rounded text-xs font-bold text-ink-muted">
          {/* No streak yet on Day 1: a grey "0" flame says nothing. */}
          {streak > 0 && <FlameStreak streak={streak} grow={false} />}
          {jokersLeft !== undefined && (
            <span className="flex items-center gap-1 text-orange-ink">
              <Icon name="joker" size={16} />
              {jokersLeft} {jokersLeft === 1 ? 'joker' : 'jokers'}
            </span>
          )}
        </div>
      </div>

      {profile && <p className="mt-3 line-clamp-2 text-center font-rounded text-xs italic text-ink-muted">“{profile.why}”</p>}
    </section>
  )
}

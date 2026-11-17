import { useEffect, useRef, type CSSProperties } from 'react'
import { WORLDS, type World } from './worlds'

interface AltitudeRailProps {
  /** The day reached: today's, or 75 once it's all done. */
  dayReached: number
  /** Jumps to a world's chapter. */
  onJump: (world: World) => void
}

/** Where on the screen the rail reads which day you're looking at: a little above the middle. */
const READ_LINE = 0.45

/**
 * The day under the read line, with a fraction for how far through its row
 * the line is, so the fill moves smoothly. Above the first row (the top of
 * the page) it's the day reached; past the last row, the climb's foot.
 */
function dayInView(dayReached: number): number {
  const rows = document.querySelectorAll<HTMLElement>('[data-log-day]')
  if (rows.length === 0) return dayReached
  const line = window.innerHeight * READ_LINE
  for (const row of rows) {
    const box = row.getBoundingClientRect()
    if (box.bottom <= line) continue
    const day = Number(row.dataset.logDay)
    if (box.top > line) return row === rows[0] ? dayReached : day + 0.5
    return day + 0.5 - (line - box.top) / box.height
  }
  return 0
}

/**
 * The climb as a thin bar down the left edge, one section per world, Hell
 * at the bottom. The fill follows the scroll: it reaches the day you're
 * looking at, climbing to today at the top of the page and sinking towards
 * Hell as you scroll back. Each section's colour rises out of the world
 * below it. Each section is a button to its chapter.
 */
export function AltitudeRail({ dayReached, onJump }: AltitudeRailProps) {
  const railRef = useRef<HTMLElement>(null)

  // Written straight to a CSS variable, once a frame at most: no re-render while scrolling.
  useEffect(() => {
    const rail = railRef.current
    if (!rail) return
    let frame = 0
    const update = () => {
      frame = 0
      rail.style.setProperty('--rail-day', String(Math.min(dayReached, dayInView(dayReached))))
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [dayReached])

  return (
    <nav
      ref={railRef}
      aria-label="The climb, by world"
      className="fixed top-[calc(env(safe-area-inset-top)+6rem)] bottom-[calc(6.5rem+env(safe-area-inset-bottom))] left-1 z-10 flex w-7 flex-col-reverse gap-1"
      style={{ '--rail-day': dayReached } as CSSProperties}
    >
      {WORLDS.map((world, i) => {
        const length = world.lastDay - world.firstDay + 1
        return (
          <button
            key={world.id}
            type="button"
            // The world below, read here so the section's colour can rise out of it.
            data-world={WORLDS[Math.max(0, i - 1)].id}
            aria-label={`Go to ${world.name}`}
            onClick={() => onJump(world)}
            className="relative flex justify-center"
            style={{ flexGrow: length, flexBasis: 0, '--below': 'var(--color-world)' } as CSSProperties}
          >
            <span data-world={world.id} className="relative h-full w-1 overflow-hidden rounded-full bg-ink/15">
              <span
                className="absolute inset-x-0 bottom-0 rounded-full motion-safe:transition-[height] motion-safe:duration-300 motion-safe:ease-out"
                style={{
                  height: `calc(clamp(0, (var(--rail-day) - ${world.firstDay - 1}) / ${length}, 1) * 100%)`,
                  background: 'linear-gradient(to top, var(--below), var(--color-world) 70%)',
                }}
              />
            </span>
          </button>
        )
      })}
    </nav>
  )
}

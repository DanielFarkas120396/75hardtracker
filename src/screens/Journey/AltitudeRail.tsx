import { Mascot } from '../../components/mascot/Mascot'
import { climbSegments } from '../../logic/climb'
import { CHALLENGE_LENGTH } from '../../logic/constants'
import { WORLDS, type World } from './worlds'

interface AltitudeRailProps {
  /** The day reached: today's, or 75 once it's all done. */
  dayReached: number
  /** Jumps to a world's chapter. */
  onJump: (world: World) => void
}

const DUCK_SIZE = 24

/**
 * The climb as a thin bar down the left edge: Hell at the bottom, Heaven at
 * the top, each world's stretch filled in its colour up to the day reached,
 * and the duck at your height. Each stretch is a button to its chapter.
 */
export function AltitudeRail({ dayReached, onJump }: AltitudeRailProps) {
  const segments = climbSegments(dayReached)
  const day = Math.min(CHALLENGE_LENGTH, Math.max(0, dayReached))

  return (
    <nav
      aria-label="The climb, by world"
      className="fixed top-[calc(env(safe-area-inset-top)+6rem)] bottom-[calc(6.5rem+env(safe-area-inset-bottom))] left-1 z-10 flex w-7 flex-col-reverse gap-1"
    >
      {segments.map((segment, i) => (
        <button
          key={segment.id}
          type="button"
          data-world={segment.id}
          aria-label={`Go to ${WORLDS[i].name}`}
          onClick={() => onJump(WORLDS[i])}
          className="relative flex justify-center"
          style={{ flexGrow: segment.share, flexBasis: 0 }}
        >
          <span className="relative h-full w-1 overflow-hidden rounded-full bg-ink/15">
            <span className="absolute inset-x-0 bottom-0 rounded-full bg-world" style={{ height: `${segment.fill * 100}%` }} />
          </span>
        </button>
      ))}
      {day > 0 && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 translate-y-1/2"
          style={{ bottom: `${((day - 0.5) / CHALLENGE_LENGTH) * 100}%` }}
        >
          <Mascot mood="content" size={DUCK_SIZE} decorative />
        </div>
      )}
    </nav>
  )
}

import { CHALLENGE_LENGTH } from '../../logic/constants'
import { WORLDS, type World } from './worlds'

interface AltitudeRailProps {
  /** The day reached: today's, or 75 once it's all done. */
  dayReached: number
  /** Jumps to a world's chapter. */
  onJump: (world: World) => void
}

/** How far, in days, each world's colour fades in over the one below it. */
const BLEND_DAYS = 4

const percent = (days: number) => `${(days / CHALLENGE_LENGTH) * 100}%`

/**
 * The climb as one thin bar down the left edge: Hell at the bottom, Heaven
 * at the top, filled up to the day reached, its colour flowing from world to
 * world. Each world's band fades in over the one below it (in its own
 * data-world colour, so it follows the theme). Over the bar, each world's
 * stretch is a button to its chapter.
 */
export function AltitudeRail({ dayReached, onJump }: AltitudeRailProps) {
  const day = Math.min(CHALLENGE_LENGTH, Math.max(0, dayReached))

  return (
    <nav
      aria-label="The climb, by world"
      className="fixed top-[calc(env(safe-area-inset-top)+6rem)] bottom-[calc(6.5rem+env(safe-area-inset-bottom))] left-1 z-10 w-7"
    >
      <div aria-hidden="true" className="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 overflow-hidden rounded-full bg-ink/15">
        <div className="absolute inset-0" style={{ clipPath: `inset(${100 - (day / CHALLENGE_LENGTH) * 100}% 0 0 0)` }}>
          {WORLDS.map((world, i) => {
            const blend = i === 0 ? 0 : BLEND_DAYS
            const from = world.firstDay - 1 - blend / 2
            // Up to the top: the next world's band covers the rest. The fade's stop is a share of this band's height.
            const span = CHALLENGE_LENGTH - from
            const fade = blend ? `linear-gradient(to top, transparent, black ${(blend / span) * 100}%)` : undefined
            return (
              <div
                key={world.id}
                data-world={world.id}
                className="absolute inset-x-0 bg-world"
                style={{ bottom: percent(from), height: percent(span), maskImage: fade, WebkitMaskImage: fade }}
              />
            )
          })}
        </div>
      </div>

      <div className="absolute inset-0 flex flex-col-reverse">
        {WORLDS.map((world) => (
          <button
            key={world.id}
            type="button"
            aria-label={`Go to ${world.name}`}
            onClick={() => onJump(world)}
            style={{ flexGrow: world.lastDay - world.firstDay + 1, flexBasis: 0 }}
          />
        ))}
      </div>
    </nav>
  )
}

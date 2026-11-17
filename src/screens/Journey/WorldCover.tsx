import { coverId } from './chapters'
import type { World } from './worlds'

interface WorldCoverProps {
  world: World
  /** The badge in the corner: the score, "Cleared", or when a locked world opens. */
  badge: string
  /** The line under the name. */
  detail: string
  /** A world ahead: greyed out, a little shorter. */
  locked?: boolean
}

/**
 * A chapter's cover: the world's picture, darkened into the page so its
 * name reads on it, in the world's colour. The page's canvas comes in as
 * --journey-canvas, since data-world gives each world a canvas of its own.
 */
export function WorldCover({ world, badge, detail, locked = false }: WorldCoverProps) {
  return (
    <section
      id={coverId(world)}
      data-world={world.id}
      aria-label={`${world.name}, ${badge}`}
      className={`relative flex flex-col justify-end overflow-hidden rounded-card px-4 py-3.5 ${locked ? 'h-20' : 'h-28'}`}
    >
      <img
        src={world.cover}
        alt=""
        loading="lazy"
        decoding="async"
        className={`absolute inset-0 h-full w-full object-cover object-[center_45%] ${locked ? 'brightness-75 grayscale' : ''}`}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(0deg, var(--journey-canvas) 0%, color-mix(in srgb, var(--journey-canvas) 72%, transparent) 55%, color-mix(in srgb, var(--journey-canvas) 30%, transparent) 100%)',
        }}
      />
      <span
        className={`absolute top-3 right-3 rounded-full px-2.5 py-0.5 font-display text-sm font-semibold tracking-wider uppercase ${
          locked ? 'bg-surface text-ink-muted' : 'bg-world text-on-world'
        }`}
      >
        {badge}
      </span>
      <h2 className={`relative font-display text-2xl leading-none font-semibold tracking-wide uppercase ${locked ? 'text-ink-muted' : 'text-world-ink'}`}>
        {world.name}
      </h2>
      <p className="relative mt-1 font-rounded text-xs font-medium text-ink">{detail}</p>
    </section>
  )
}

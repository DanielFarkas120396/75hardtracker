import { CHALLENGE_LENGTH } from '../../logic/constants'
import { BLEND, DAY_SPACING, easedFade, MAP_HEIGHT, MAP_WIDTH, seeded, TILE_FADE, tilePlacements, worldBand, worldSpan, yForDay } from './layout'
import { WORLDS, worldForDay, type ParticleKind } from './worlds'

/**
 * Everything behind the road: each world's background images, repeated down
 * its band, over a backdrop in the worlds' colours, plus a few small moving
 * touches.
 *
 * Transitions are true cross-fades: worlds are drawn from the bottom (hell)
 * up, and each one fades out at its bottom over the world below, which stays
 * opaque underneath. Within a world, each lower copy of the image fades in at
 * its top over the copy above. Every fade follows an eased curve.
 */

/** A world, fading out along its bottom edge over the world below it (hell, at the bottom, doesn't fade). */
function WorldMask({ index }: { index: number }) {
  const { start, end } = worldSpan(index)
  const span = end - start
  const fadeFrom = index === 0 ? 1 : 1 - BLEND / span
  return (
    <mask id={`journey-world-${index}`} maskUnits="userSpaceOnUse" x={0} y={start} width={MAP_WIDTH} height={span}>
      <linearGradient id={`journey-world-fade-${index}`} gradientUnits="userSpaceOnUse" x1={0} y1={start} x2={0} y2={end}>
        <stop offset={0} stopColor="#fff" />
        {/* Gradient stops must ascend, so the fade is listed from where it starts down to the bottom edge. */}
        {easedFade(1, fadeFrom)
          .reverse()
          .map(({ offset, opacity }) => (
            <stop key={offset} offset={offset.toFixed(4)} stopColor="#fff" stopOpacity={opacity.toFixed(3)} />
          ))}
      </linearGradient>
      <rect x={0} y={start} width={MAP_WIDTH} height={span} fill={`url(#journey-world-fade-${index})`} />
    </mask>
  )
}

/** The worlds' colours down the whole map, blending across each border along the same eased curve. */
function BackdropGradient() {
  const stops = [
    { offset: 0, color: WORLDS[WORLDS.length - 1].backdrop },
    ...WORLDS.slice(1).flatMap((world, j) => {
      const border = worldBand(j + 1).bottom
      const below = WORLDS[j].backdrop
      // From the world below (at the bottom of the blend) up to this one (at its top).
      return easedFade((border + BLEND / 2) / MAP_HEIGHT, (border - BLEND / 2) / MAP_HEIGHT).map(({ offset, opacity }) => ({
        offset,
        color: mixColors(below, world.backdrop, opacity),
      }))
    }),
    { offset: 1, color: WORLDS[0].backdrop },
  ].sort((x, y) => x.offset - y.offset)

  return (
    <linearGradient id="journey-backdrop" gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={0} y2={MAP_HEIGHT}>
      {stops.map((stop) => (
        <stop key={stop.offset} offset={stop.offset.toFixed(4)} stopColor={stop.color} />
      ))}
    </linearGradient>
  )
}

/** A colour `t` of the way from `a` to `b` (both #rrggbb). */
function mixColors(a: string, b: string, t: number): string {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)
  return `#${[0, 1, 2]
    .map((i) => Math.round(channel(a, i) + (channel(b, i) - channel(a, i)) * t).toString(16).padStart(2, '0'))
    .join('')}`
}

// --- Moving touches ------------------------------------------------------

const PARTICLE_STYLE: Record<ParticleKind, { className: string; fill: string; r: number }> = {
  ember: { className: 'journey-rise', fill: '#ffb347', r: 2.4 },
  ash: { className: 'journey-rise', fill: '#e6dfd8', r: 1.8 },
  firefly: { className: 'journey-twinkle', fill: '#e8ff8a', r: 2.2 },
  petal: { className: 'journey-fall', fill: '#ff8fb8', r: 2.2 },
  snow: { className: 'journey-fall', fill: '#ffffff', r: 2.4 },
  sparkle: { className: 'journey-twinkle', fill: '#e8b730', r: 2.6 },
}

/** One small moving touch near each day, along the edges where the images have their scenery. Hidden under reduce motion. */
function Particles() {
  const days = Array.from({ length: CHALLENGE_LENGTH }, (_, i) => i + 1)
  return (
    <g className="journey-particles">
      {days.map((day) => {
        const { className, fill, r } = PARTICLE_STYLE[worldForDay(day).particle]
        const left = seeded(day, 11) < 0.5
        const x = left ? 12 + seeded(day, 12) * 56 : MAP_WIDTH - 12 - seeded(day, 12) * 56
        const y = yForDay(day) + (seeded(day, 13) - 0.5) * DAY_SPACING
        return (
          <circle
            key={day}
            cx={x.toFixed(1)}
            cy={y.toFixed(1)}
            r={r}
            fill={fill}
            className={className}
            style={{ animationDelay: `${(seeded(day, 14) * 4).toFixed(2)}s` }}
          />
        )
      })}
    </g>
  )
}

export function JourneyScenery() {
  return (
    <g aria-hidden="true">
      <defs>
        <linearGradient id="journey-tile-fade" x1={0} y1={0} x2={0} y2={1}>
          {easedFade(0, TILE_FADE).map(({ offset, opacity }) => (
            <stop key={offset} offset={offset.toFixed(4)} stopColor="#fff" stopOpacity={opacity.toFixed(3)} />
          ))}
        </linearGradient>
        <mask id="journey-tile" maskContentUnits="objectBoundingBox">
          <rect width={1} height={1} fill="url(#journey-tile-fade)" />
        </mask>
        {WORLDS.map((world, i) => (
          <WorldMask key={world.id} index={i} />
        ))}
        <BackdropGradient />
      </defs>

      {/* The worlds' colours behind the images, so a fade never shows through to nothing. */}
      <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#journey-backdrop)" />

      {WORLDS.map((world, i) => (
        <g key={world.id} mask={`url(#journey-world-${i})`}>
          {tilePlacements(i).map(({ tile, y, height }, k) => (
            <image
              key={k}
              href={tile.src}
              x={0}
              y={y.toFixed(1)}
              width={MAP_WIDTH}
              height={height.toFixed(1)}
              preserveAspectRatio="none"
              // A world's first copy sits under the world above it; each later copy fades in over the one above.
              mask={k === 0 ? undefined : 'url(#journey-tile)'}
            />
          ))}
        </g>
      ))}

      <Particles />
    </g>
  )
}

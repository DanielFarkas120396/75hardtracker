import { CHALLENGE_LENGTH } from '../../logic/constants'
import { BLEND, DAY_SPACING, MAP_WIDTH, seeded, TILE_FADE, tilePlacements, worldBand, worldSpan, yForDay } from './layout'
import { WORLDS, worldForDay, type ParticleKind } from './worlds'

/**
 * Everything behind the road: each world's background images, repeated down
 * its band with soft fades between copies and into the neighbouring worlds,
 * over a backdrop in the worlds' colours, plus a few small moving touches.
 */

/** A world's span, faded in and out where it overlaps its neighbours. */
function WorldMask({ index }: { index: number }) {
  const { start, end } = worldSpan(index)
  const span = end - start
  const fadeTop = index === WORLDS.length - 1 ? 0 : BLEND / span
  const fadeBottom = index === 0 ? 0 : BLEND / span
  return (
    <mask id={`journey-world-${index}`} maskUnits="userSpaceOnUse" x={0} y={start} width={MAP_WIDTH} height={span}>
      <linearGradient id={`journey-world-fade-${index}`} gradientUnits="userSpaceOnUse" x1={0} y1={start} x2={0} y2={end}>
        <stop offset={0} stopColor="#fff" stopOpacity={fadeTop ? 0 : 1} />
        <stop offset={fadeTop} stopColor="#fff" />
        <stop offset={1 - fadeBottom} stopColor="#fff" />
        <stop offset={1} stopColor="#fff" stopOpacity={fadeBottom ? 0 : 1} />
      </linearGradient>
      <rect x={0} y={start} width={MAP_WIDTH} height={span} fill={`url(#journey-world-fade-${index})`} />
    </mask>
  )
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
          <stop offset={0} stopColor="#fff" stopOpacity={0} />
          <stop offset={TILE_FADE} stopColor="#fff" />
          <stop offset={1 - TILE_FADE} stopColor="#fff" />
          <stop offset={1} stopColor="#fff" stopOpacity={0} />
        </linearGradient>
        <mask id="journey-tile" maskContentUnits="objectBoundingBox">
          <rect width={1} height={1} fill="url(#journey-tile-fade)" />
        </mask>
        {WORLDS.map((world, i) => (
          <WorldMask key={world.id} index={i} />
        ))}
      </defs>

      {/* Each world's colour behind its images, so fades never show through to nothing. */}
      {WORLDS.map((world, i) => {
        const { top, bottom } = worldBand(i)
        return <rect key={world.id} x={0} y={top} width={MAP_WIDTH} height={bottom - top} fill={world.backdrop} />
      })}

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
              // Heaven's gates image starts flush with the top of the map; every other copy fades at its edges.
              mask={i === WORLDS.length - 1 && k === 0 ? undefined : 'url(#journey-tile)'}
            />
          ))}
        </g>
      ))}

      <Particles />
    </g>
  )
}

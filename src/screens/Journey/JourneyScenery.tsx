import type { ReactNode } from 'react'
import { CHALLENGE_LENGTH } from '../../logic/constants'
import { CENTER_X, DAY_SPACING, GATES_RISE, MAP_HEIGHT, MAP_WIDTH, scenerySide, seeded, worldBand, yForDay } from './layout'
import { WORLDS, worldForDay, type WorldId } from './worlds'

/**
 * Everything behind the road: each world's backdrop (blended into its
 * neighbours), its scenery along both edges, and heaven's gates. Drawn in
 * code and placed deterministically, so the map looks the same every visit.
 */

/** How far a world's colour bleeds into its neighbour, in SVG units. */
const BLEND = DAY_SPACING * 0.7

interface PropProps {
  x: number
  y: number
  scale?: number
  /** Animation offset in seconds, so neighbouring props don't move in sync. */
  delay?: number
}

/** Places a prop drawn around (0, 0) — its foot — at (x, y). */
function At({ x, y, scale = 1, children }: PropProps & { children: ReactNode }) {
  return <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale.toFixed(2)})`}>{children}</g>
}

const delayStyle = (delay = 0) => ({ animationDelay: `${delay.toFixed(2)}s` })

// --- Hell ---------------------------------------------------------------

function Flame({ delay, ...at }: PropProps) {
  return (
    <At {...at}>
      <g className="journey-flicker" style={delayStyle(delay)}>
        <path d="M0 0 C-14 -8 -12 -26 -2 -40 C-2 -28 6 -26 8 -34 C16 -22 14 -6 0 0 Z" fill="#f59b2b" />
        <path d="M0 0 C-7 -4 -6 -14 0 -22 C2 -14 6 -12 6 -8 C6 -3 3 0 0 0 Z" fill="#ffd84a" />
      </g>
    </At>
  )
}

function LavaPool({ delay, ...at }: PropProps) {
  return (
    <At {...at}>
      <ellipse rx={26} ry={8} fill="#8a1e0c" />
      <ellipse rx={21} ry={5.5} fill="#e2531f" />
      <ellipse cx={-6} cy={-1} rx={8} ry={2} fill="#ffb347" />
      <circle cx={6} cy={-4} r={3} fill="#ff7a2f" className="journey-bubble" style={delayStyle(delay)} />
    </At>
  )
}

function Rock({ color, ...at }: PropProps & { color: string }) {
  return (
    <At {...at}>
      <path d="M-14 0 L-10 -12 L-2 -17 L9 -13 L14 0 Z" fill={color} />
      <path d="M-2 -17 L9 -13 L4 -6 Z" fill="#ffffff" opacity={0.08} />
    </At>
  )
}

// --- Wasteland ----------------------------------------------------------

function DeadTree(at: PropProps) {
  return (
    <At {...at}>
      <g stroke="#2a211d" strokeWidth={3.5} strokeLinecap="round" fill="none">
        <path d="M0 0 V-42" />
        <path d="M0 -22 L-12 -32 L-15 -40" />
        <path d="M0 -30 L10 -40" />
        <path d="M-6 -27 L-12 -24" />
      </g>
    </At>
  )
}

function Sprout({ delay, ...at }: PropProps) {
  return (
    <At {...at}>
      <g className="journey-sway" style={delayStyle(delay)}>
        <path d="M0 0 V-10" stroke="#5ba35a" strokeWidth={2} />
        <ellipse cx={-4} cy={-11} rx={4} ry={2} fill="#7cc264" transform="rotate(-25 -4 -11)" />
        <ellipse cx={4} cy={-12} rx={4} ry={2} fill="#7cc264" transform="rotate(25 4 -12)" />
      </g>
    </At>
  )
}

// --- Forest ---------------------------------------------------------------

function Pine({ delay, light = false, ...at }: PropProps & { light?: boolean }) {
  return (
    <At {...at}>
      <rect x={-2.5} y={-8} width={5} height={8} fill="#3b2614" />
      <g className="journey-sway" style={delayStyle(delay)}>
        <path d="M0 -58 L-18 -24 L18 -24 Z" fill={light ? '#2f6b3f' : '#16301f'} />
        <path d="M0 -42 L-22 -8 L22 -8 Z" fill={light ? '#2a5e38' : '#1a3a26'} />
      </g>
    </At>
  )
}

function Mushroom(at: PropProps) {
  return (
    <At {...at}>
      <rect x={-2} y={-7} width={4} height={7} rx={1.5} fill="#f3e6d3" />
      <path d="M-8 -6 Q0 -16 8 -6 Z" fill="#d8492f" />
      <circle cx={-2} cy={-9} r={1.3} fill="#ffffff" />
      <circle cx={3} cy={-8} r={1} fill="#ffffff" />
    </At>
  )
}

// --- Meadows --------------------------------------------------------------

function Flowers({ delay, ...at }: PropProps) {
  const heads = [
    [-9, -12, '#f7e15b'],
    [0, -17, '#ff8fb8'],
    [9, -11, '#ffffff'],
  ] as const
  return (
    <At {...at}>
      <g className="journey-sway" style={delayStyle(delay)}>
        {heads.map(([x, y, color]) => (
          <g key={`${x}`}>
            <path d={`M${x} 0 L${x} ${y}`} stroke="#3f8a3a" strokeWidth={1.8} />
            <circle cx={x} cy={y} r={3.6} fill={color} />
            <circle cx={x} cy={y} r={1.3} fill="#e8a33a" />
          </g>
        ))}
      </g>
    </At>
  )
}

function Bush(at: PropProps) {
  return (
    <At {...at}>
      <circle cx={-9} cy={-8} r={9} fill="#4f9a45" />
      <circle cx={8} cy={-9} r={10} fill="#4f9a45" />
      <circle cx={0} cy={-15} r={11} fill="#5aac4f" />
    </At>
  )
}

function RoundTree({ delay, ...at }: PropProps) {
  return (
    <At {...at}>
      <rect x={-3} y={-20} width={6} height={20} fill="#6b4423" />
      <g className="journey-sway" style={delayStyle(delay)}>
        <circle cy={-34} r={18} fill="#3f8a3a" />
        <circle cx={-7} cy={-39} r={8} fill="#57a64b" />
      </g>
    </At>
  )
}

// --- Mountains ------------------------------------------------------------

function Peak(at: PropProps) {
  return (
    <At {...at}>
      <path d="M-44 0 L0 -70 L44 0 Z" fill="#7e8c9c" />
      <path d="M0 -70 L44 0 L14 0 Z" fill="#6c7a8a" />
      <path d="M0 -70 L-13 -50 L-6 -53 L0 -46 L7 -54 L13 -50 Z" fill="#ffffff" />
    </At>
  )
}

function SnowPine(at: PropProps) {
  return (
    <At {...at}>
      <rect x={-2} y={-6} width={4} height={6} fill="#3b2614" />
      <path d="M0 -40 L-13 -16 L13 -16 Z" fill="#2f5d4a" />
      <path d="M0 -30 L-16 -5 L16 -5 Z" fill="#2a5444" />
      <path d="M0 -40 L-5 -31 L5 -31 Z" fill="#ffffff" />
    </At>
  )
}

// --- Heaven ---------------------------------------------------------------

function Cloud({ delay, ...at }: PropProps) {
  return (
    <At {...at}>
      <g className="journey-drift" style={delayStyle(delay)}>
        <ellipse cx={0} cy={-8} rx={30} ry={10} fill="#ffffff" />
        <circle cx={-10} cy={-14} r={10} fill="#ffffff" />
        <circle cx={8} cy={-17} r={13} fill="#ffffff" />
      </g>
    </At>
  )
}

function Sparkle(at: PropProps) {
  return (
    <At {...at}>
      <path d="M0 -10 L2 -2 L10 0 L2 2 L0 10 L-2 2 L-10 0 L-2 -2 Z" fill="#f3c23a" />
    </At>
  )
}

/** Heaven's gates, above Day 75, with light rays behind them. Drawn over the road, which ends at their threshold. */
export function JourneyGates() {
  const y = yForDay(CHALLENGE_LENGTH) - GATES_RISE
  return (
    <g>
      <g fill="#f0d27a" opacity={0.45}>
        <polygon points={`${CENTER_X},0 ${CENTER_X - 40},${y + 70} ${CENTER_X + 40},${y + 70}`} />
        <polygon points={`${CENTER_X},0 ${CENTER_X - 150},${y + 40} ${CENTER_X - 110},${y + 70}`} />
        <polygon points={`${CENTER_X},0 ${CENTER_X + 150},${y + 40} ${CENTER_X + 110},${y + 70}`} />
      </g>
      <g transform={`translate(${CENTER_X} ${y})`} stroke="#c9a227" strokeWidth={4} fill="none" strokeLinecap="round">
        <path d="M-38 30 V-12 A38 30 0 0 1 38 -12 V30" />
        <path d="M-19 30 V-30 M0 30 V-35 M19 30 V-30" />
        <path d="M-38 6 H38" strokeWidth={3} />
        <circle cy={-28} r={5} fill="#f3c23a" />
      </g>
      <Cloud x={CENTER_X - 62} y={y + 44} scale={1.3} delay={0} />
      <Cloud x={CENTER_X + 64} y={y + 46} scale={1.2} delay={4} />
    </g>
  )
}

// --- Layout -----------------------------------------------------------------

type PropKind = (props: PropProps) => ReactNode

const PROPS: Record<WorldId, { main: PropKind[]; small: PropKind[] }> = {
  hell: {
    main: [Flame, LavaPool, (p) => <Flame {...p} scale={(p.scale ?? 1) * 1.3} />],
    small: [(p) => <Rock {...p} color="#5a1a12" />, Flame],
  },
  wasteland: {
    main: [DeadTree, (p) => <Rock {...p} color="#6b5d55" scale={(p.scale ?? 1) * 1.4} />, DeadTree],
    small: [(p) => <Rock {...p} color="#5e5048" />, Sprout],
  },
  forest: {
    main: [Pine, (p) => <Pine {...p} light />, Pine],
    small: [Mushroom, (p) => <Pine {...p} scale={(p.scale ?? 1) * 0.6} light />],
  },
  meadow: {
    main: [RoundTree, Bush, Flowers],
    small: [Flowers, Bush],
  },
  mountains: {
    main: [Peak, SnowPine, Peak],
    small: [SnowPine, (p) => <Rock {...p} color="#8a96a3" />],
  },
  heaven: {
    main: [Cloud, Cloud, Sparkle],
    small: [Sparkle, Cloud],
  },
}

/** First day of each world: its sign stands there instead of a prop. */
const SIGN_DAYS = new Set(WORLDS.map((w) => w.firstDay))

function pick<T>(list: T[], r: number): T {
  return list[Math.floor(r * list.length)]
}

/** One prop beside each day on the open side of the road, and a smaller one on the far edge between days. */
function DayProps({ day }: { day: number }) {
  const props = PROPS[worldForDay(day).id]
  const side = scenerySide(day)
  const y = yForDay(day)
  const edge = (s: 'left' | 'right', inset: number) => (s === 'left' ? inset : MAP_WIDTH - inset)

  const Main = pick(props.main, seeded(day, 1))
  const Small = pick(props.small, seeded(day, 2))
  const otherSide = side === 'left' ? 'right' : 'left'

  return (
    <>
      {/* Props are plain drawing functions (no hooks), so they're called rather than mounted. */}
      {!SIGN_DAYS.has(day) &&
        Main({
          x: edge(side, 34 + seeded(day, 3) * 22),
          y: y + 18 + seeded(day, 4) * 14,
          scale: 0.85 + seeded(day, 5) * 0.35,
          delay: seeded(day, 6) * 3,
        })}
      {/* The small props hold still, so only one thing per day moves. */}
      <g className="journey-still">
        {Small({
          x: edge(otherSide, 14 + seeded(day, 7) * 12),
          y: y - DAY_SPACING / 2 + seeded(day, 8) * 10,
          scale: 0.7 + seeded(day, 9) * 0.3,
        })}
      </g>
    </>
  )
}

/** A lava river under Day 1 and a stream through the meadows. */
function Landmarks() {
  const meadow = worldBand(WORLDS.findIndex((w) => w.id === 'meadow'))
  return (
    <>
      <path
        d={`M0 ${MAP_HEIGHT - 26} Q80 ${MAP_HEIGHT - 44} 160 ${MAP_HEIGHT - 28} T320 ${MAP_HEIGHT - 30} V${MAP_HEIGHT} H0 Z`}
        fill="#e2531f"
      />
      <path
        d={`M0 ${MAP_HEIGHT - 14} Q90 ${MAP_HEIGHT - 26} 170 ${MAP_HEIGHT - 14} T320 ${MAP_HEIGHT - 16}`}
        stroke="#ffb347"
        strokeWidth={3}
        fill="none"
      />
      <path
        d={`M-6 ${meadow.bottom} C40 ${meadow.bottom - 200} -20 ${meadow.bottom - 420} 26 ${meadow.bottom - 640} S-10 ${meadow.top + 160} 10 ${meadow.top}`}
        stroke="#5ab0e8"
        strokeWidth={14}
        fill="none"
        strokeLinecap="round"
      />
    </>
  )
}

export function JourneyScenery() {
  // One vertical gradient for the whole map: each world holds its colour over its band and blends at the edges.
  const stops = WORLDS.flatMap((world, i) => {
    const { top, bottom } = worldBand(i)
    const from = i === WORLDS.length - 1 ? top : top + BLEND / 2
    const to = i === 0 ? bottom : bottom - BLEND / 2
    return [
      { offset: from / MAP_HEIGHT, color: world.backdrop },
      { offset: to / MAP_HEIGHT, color: world.backdrop },
    ]
  }).sort((a, b) => a.offset - b.offset)

  const days = Array.from({ length: CHALLENGE_LENGTH }, (_, i) => i + 1)

  return (
    <g aria-hidden="true">
      <defs>
        <linearGradient id="journey-backdrop" gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={0} y2={MAP_HEIGHT}>
          {stops.map((s, i) => (
            <stop key={i} offset={s.offset.toFixed(4)} stopColor={s.color} />
          ))}
        </linearGradient>
      </defs>
      <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#journey-backdrop)" />
      <Landmarks />
      {days.map((day) => (
        <DayProps key={day} day={day} />
      ))}
    </g>
  )
}

import { motion, useReducedMotion } from 'framer-motion'
import type { World, WorldId } from '../Journey/worlds'

export type NodeState = 'completed' | 'today' | 'locked' | 'missed'

const RADIUS = 22

const STATE_LABELS: Record<NodeState, string> = {
  completed: 'completed',
  today: 'today',
  locked: 'not reached yet',
  missed: 'forgiven with a joker',
}

interface ClimbStoneProps {
  x: number
  y: number
  dayNumber: number
  state: NodeState
  world: World
}

/** The texture that makes a stone belong to its world, drawn over the stone's face. */
function Texture({ world }: { world: WorldId }) {
  switch (world) {
    case 'hell':
      return (
        <path
          d="M-12 -6 L-4 -2 L-6 6 M4 -12 L2 -3 L10 2"
          stroke="#ffd84a"
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          opacity={0.7}
        />
      )
    case 'wasteland':
      return (
        <g fill="#5e5048" opacity={0.35}>
          <circle cx={-10} cy={-8} r={2} />
          <circle cx={11} cy={5} r={2.5} />
          <circle cx={-6} cy={11} r={1.5} />
        </g>
      )
    case 'forest':
      return <circle r={RADIUS - 7} fill="none" stroke="#5b3a1e" strokeWidth={1.5} opacity={0.35} />
    case 'mountains':
      return <path d="M-14 -8 A16 16 0 0 1 -4 -16" stroke="#ffffff" strokeWidth={3} fill="none" strokeLinecap="round" />
    default:
      return null
  }
}

/** Shapes behind the stone's face: petals in the meadows, puffs of cloud in heaven. */
function Halo({ world }: { world: World }) {
  if (world.id === 'meadow') {
    return (
      <g fill={world.stone.rim}>
        {[0, 72, 144, 216, 288].map((angle) => (
          <circle key={angle} r={9} cx={0} cy={-RADIUS + 2} transform={`rotate(${angle})`} />
        ))}
      </g>
    )
  }
  if (world.id === 'heaven') {
    return (
      <g fill="#ffffff">
        <circle cx={-RADIUS + 2} cy={6} r={10} />
        <circle cx={RADIUS - 2} cy={6} r={10} />
      </g>
    )
  }
  return null
}

/** A padlock on the stone's lower-right edge, for days not reached yet. */
function LockBadge() {
  const offset = RADIUS * 0.72
  return (
    <g transform={`translate(${offset} ${offset})`}>
      <circle r={8} fill="#ffffff" />
      <path d="M-2.5 -0.5V-2.5a2.5 2.5 0 0 1 5 0V-0.5" fill="none" stroke="#5f6b66" strokeWidth={1.5} />
      <rect x={-4} y={-1} width={8} height={6} rx={1.5} fill="#5f6b66" />
    </g>
  )
}

/** One day of the climb as a stepping stone in its world's style: the day-complete celebration's stretch of road. */
export function ClimbStone({ x, y, dayNumber, state, world }: ClimbStoneProps) {
  const reduceMotion = useReducedMotion()
  const { face, rim, ink } = world.stone
  const dim = state === 'locked' || state === 'missed'

  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`} role="img" aria-label={`Day ${dayNumber}, ${STATE_LABELS[state]}`}>
      <ellipse cy={RADIUS - 2} rx={RADIUS} ry={7} fill="#000000" opacity={0.22} />
      {state === 'today' &&
        (reduceMotion ? (
          <circle r={RADIUS + 8} fill="none" stroke="#ff8a3d" strokeWidth={3.5} />
        ) : (
          <motion.circle
            r={RADIUS + 8}
            fill="none"
            stroke="#ff8a3d"
            strokeWidth={3.5}
            animate={{ scale: [1, 1.15, 1], opacity: [0.95, 0.4, 0.95] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
      <g opacity={dim ? 0.5 : 1}>
        <Halo world={world} />
        <circle r={RADIUS} fill={face} stroke={rim} strokeWidth={4} />
        <Texture world={world.id} />
      </g>
      {state === 'completed' ? (
        <path d="M-8 0 L-2 6 L9 -7" stroke={ink} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      ) : state === 'missed' ? (
        <text textAnchor="middle" dominantBaseline="central" fontSize={18}>
          🃏
        </text>
      ) : (
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={15}
          fontWeight={800}
          fill={ink}
          opacity={state === 'locked' ? 0.75 : 1}
        >
          {dayNumber}
        </text>
      )}
      {state === 'locked' && <LockBadge />}
    </g>
  )
}

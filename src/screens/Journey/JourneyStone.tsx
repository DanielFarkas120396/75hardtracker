import { motion, useReducedMotion } from 'framer-motion'
import type { KeyboardEvent, MouseEvent } from 'react'
import type { World, WorldId } from './worlds'

export type NodeState = 'completed' | 'today' | 'locked' | 'missed'

const RADIUS = 22

const STATE_LABELS: Record<NodeState, string> = {
  completed: 'completed',
  today: 'today',
  locked: 'not reached yet',
  missed: 'forgiven with a joker',
}

interface JourneyStoneProps {
  x: number
  y: number
  dayNumber: number
  state: NodeState
  world: World
  isMilestone: boolean
  /** A milestone already passed: its flag waves. */
  flagWaves: boolean
  /** Opens the day's card, from the point tapped; days not reached yet can't be opened. */
  onOpen?: (dayNumber: number, from: { x: number; y: number }) => void
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

/** A small flag planted beside a milestone; it waves once the milestone is behind you. */
function Flag({ waves, color }: { waves: boolean; color: string }) {
  return (
    <g transform={`translate(${RADIUS - 2} ${-RADIUS + 4})`}>
      <path d="M0 0 V-30" stroke="#3b2614" strokeWidth={2.5} strokeLinecap="round" />
      <path d="M1 -30 L19 -25 L1 -19 Z" fill={color} className={waves ? 'journey-wave' : undefined} />
    </g>
  )
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

/** One day on the Journey: a stepping stone in its world's style. */
export function JourneyStone({ x, y, dayNumber, state, world, isMilestone, flagWaves, onOpen }: JourneyStoneProps) {
  const stone = <Stone x={x} y={y} dayNumber={dayNumber} state={state} world={world} isMilestone={isMilestone} flagWaves={flagWaves} />
  if (!onOpen || state === 'locked') return stone

  const centre = (target: Element) => {
    const box = target.getBoundingClientRect()
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
  }
  // A tap grows the card from the finger; the keyboard, from the stone's middle.
  const onClick = (e: MouseEvent<SVGGElement>) =>
    onOpen(dayNumber, e.clientX || e.clientY ? { x: e.clientX, y: e.clientY } : centre(e.currentTarget))
  const onKeyDown = (e: KeyboardEvent<SVGGElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    onOpen(dayNumber, centre(e.currentTarget))
  }

  return (
    <g role="button" tabIndex={0} aria-label={`Open Day ${dayNumber}`} onClick={onClick} onKeyDown={onKeyDown} className="cursor-pointer">
      {/* A touch target a little wider than the stone. */}
      <circle cx={x} cy={y} r={RADIUS + 6} fill="transparent" />
      {stone}
    </g>
  )
}

function Stone({ x, y, dayNumber, state, world, isMilestone, flagWaves }: Omit<JourneyStoneProps, 'onOpen'>) {
  const reduceMotion = useReducedMotion()
  const { face, rim, ink } = world.stone
  const dim = state === 'locked' || state === 'missed'

  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`} role="img" aria-label={`Day ${dayNumber}, ${STATE_LABELS[state]}`}>
      {isMilestone && <Flag waves={flagWaves} color={dayNumber === 75 ? '#f3c23a' : '#e2412f'} />}
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
      {isMilestone && (
        <g transform={`translate(0 ${RADIUS + 20})`}>
          <rect x={-24} y={-9} width={48} height={18} rx={9} fill="#ffffff" opacity={0.9} />
          <text textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={800} fill="#3b2614">
            Day {dayNumber}
          </text>
        </g>
      )}
      {state === 'locked' && <LockBadge />}
    </g>
  )
}

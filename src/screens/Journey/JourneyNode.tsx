import { motion } from 'framer-motion'

export type NodeState = 'completed' | 'today' | 'locked'

interface JourneyNodeProps {
  x: number
  y: number
  dayNumber: number
  state: NodeState
  isMilestone: boolean
}

const RADIUS = 22

export function JourneyNode({ x, y, dayNumber, state, isMilestone }: JourneyNodeProps) {
  const fill = state === 'locked' ? 'var(--color-ink-muted)' : isMilestone ? 'var(--color-yellow)' : 'var(--color-green)'
  const opacity = state === 'locked' ? 0.35 : 1

  return (
    <g transform={`translate(${x} ${y})`} opacity={opacity}>
      {state === 'today' && (
        <motion.circle
          r={RADIUS + 6}
          fill="none"
          stroke="var(--color-orange)"
          strokeWidth={3}
          animate={{ scale: [1, 1.15, 1], opacity: [0.8, 0.3, 0.8] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      <circle r={RADIUS} fill={fill} stroke={isMilestone ? 'var(--color-yellow-dark)' : 'transparent'} strokeWidth={3} />
      {state === 'completed' ? (
        <text textAnchor="middle" dominantBaseline="central" fontSize={20} fill="white">
          ✓
        </text>
      ) : (
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={14}
          fontWeight={800}
          fill={state === 'locked' ? 'white' : isMilestone ? 'var(--color-ink)' : 'white'}
        >
          {dayNumber}
        </text>
      )}
      {isMilestone && (
        <text textAnchor="middle" y={RADIUS + 18} fontSize={11} fontWeight={800} fill="var(--color-ink-muted)">
          Day {dayNumber}
        </text>
      )}
    </g>
  )
}

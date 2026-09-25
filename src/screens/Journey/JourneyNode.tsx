import { motion, useReducedMotion } from 'framer-motion'

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
  const reduceMotion = useReducedMotion()
  const fill = state === 'locked' ? 'var(--color-ink-muted)' : isMilestone ? 'var(--color-yellow)' : 'var(--color-green)'
  const opacity = state === 'locked' ? 0.35 : 1

  return (
    <g transform={`translate(${x} ${y})`}>
      <g opacity={opacity}>
        {state === 'today' &&
          (reduceMotion ? (
            <circle r={RADIUS + 6} fill="none" stroke="var(--color-orange)" strokeWidth={3} opacity={0.8} />
          ) : (
            <motion.circle
              r={RADIUS + 6}
              fill="none"
              stroke="var(--color-orange)"
              strokeWidth={3}
              animate={{ scale: [1, 1.15, 1], opacity: [0.8, 0.3, 0.8] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            />
          ))}
        <circle
          r={RADIUS}
          fill={fill}
          stroke={isMilestone ? 'var(--color-yellow-dark)' : 'transparent'}
          strokeWidth={3}
        />
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
            fill={state === 'locked' ? 'white' : isMilestone ? 'var(--color-on-accent)' : 'white'}
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
      {/* Outside the faded group, so the lock stays crisp on a dimmed node. */}
      {state === 'locked' && <LockBadge />}
    </g>
  )
}

/** A small padlock on the node's lower-right edge, for days not reached yet. */
function LockBadge() {
  const offset = RADIUS * 0.72
  return (
    <g transform={`translate(${offset} ${offset})`}>
      <circle r={8} fill="var(--color-surface)" />
      <path d="M-2.5 -0.5V-2.5a2.5 2.5 0 0 1 5 0V-0.5" fill="none" stroke="var(--color-ink-muted)" strokeWidth={1.5} />
      <rect x={-4} y={-1} width={8} height={6} rx={1.5} fill="var(--color-ink-muted)" />
    </g>
  )
}

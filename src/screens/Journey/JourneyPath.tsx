import { useEffect, useRef } from 'react'
import { CHALLENGE_LENGTH, MILESTONES } from '../../logic/constants'
import { JourneyNode, type NodeState } from './JourneyNode'

const WIDTH = 320
const CENTER_X = WIDTH / 2
const AMPLITUDE = 90
const NODE_SPACING = 90
const TOP_PADDING = 60
const BOTTOM_PADDING = 60
const WAVE_PERIOD = 4 // nodes per full left-right swing

interface JourneyPathProps {
  completedDayNumbers: Set<number>
  todayDayNumber: number
}

function xForIndex(index: number): number {
  return CENTER_X + AMPLITUDE * Math.sin((index / WAVE_PERIOD) * Math.PI * 2)
}

function yForIndex(index: number): number {
  return TOP_PADDING + index * NODE_SPACING
}

export function JourneyPath({ completedDayNumbers, todayDayNumber }: JourneyPathProps) {
  const todayRef = useRef<SVGGElement>(null)

  useEffect(() => {
    todayRef.current?.scrollIntoView({ block: 'center' })
  }, [])

  const days = Array.from({ length: CHALLENGE_LENGTH }, (_, i) => i + 1)
  const height = TOP_PADDING + (CHALLENGE_LENGTH - 1) * NODE_SPACING + BOTTOM_PADDING

  const linePoints = days.map((_, i) => `${xForIndex(i)},${yForIndex(i)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${WIDTH} ${height}`} width="100%" style={{ display: 'block' }}>
      <polyline points={linePoints} fill="none" stroke="var(--color-green-light)" strokeWidth={8} strokeLinecap="round" />
      {days.map((dayNumber, i) => {
        const state: NodeState =
          dayNumber === todayDayNumber ? 'today' : completedDayNumbers.has(dayNumber) ? 'completed' : 'locked'
        const isMilestone = (MILESTONES as readonly number[]).includes(dayNumber)

        return (
          <g key={dayNumber} ref={dayNumber === todayDayNumber ? todayRef : undefined}>
            <JourneyNode x={xForIndex(i)} y={yForIndex(i)} dayNumber={dayNumber} state={state} isMilestone={isMilestone} />
          </g>
        )
      })}
    </svg>
  )
}

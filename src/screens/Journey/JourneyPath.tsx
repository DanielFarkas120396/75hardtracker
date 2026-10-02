import { Mascot } from '../../components/mascot/Mascot'
import { CHALLENGE_LENGTH, MILESTONES } from '../../logic/constants'
import { JourneyGates, JourneyScenery } from './JourneyScenery'
import { JourneySign } from './JourneySign'
import { JourneyStone, type NodeState } from './JourneyStone'
import { MAP_HEIGHT, MAP_WIDTH, roadPath, scenerySide, xForDay, yForDay } from './layout'
import { WORLDS, worldForDay } from './worlds'

interface JourneyPathProps {
  completedDayNumbers: Set<number>
  missedDayNumbers: Set<number>
  todayDayNumber: number
}

const ROAD = roadPath()
const DUCK_SIZE = 46

function stateFor(dayNumber: number, props: JourneyPathProps): NodeState {
  if (dayNumber === props.todayDayNumber) return 'today'
  if (props.completedDayNumbers.has(dayNumber)) return 'completed'
  if (props.missedDayNumbers.has(dayNumber)) return 'missed'
  return 'locked'
}

/** The climb from hell (Day 1, at the bottom) to heaven (Day 75, at the top). */
export function JourneyPath(props: JourneyPathProps) {
  const { todayDayNumber } = props
  const days = Array.from({ length: CHALLENGE_LENGTH }, (_, i) => i + 1)
  const showDuck = Number.isInteger(todayDayNumber) && todayDayNumber >= 1 && todayDayNumber <= CHALLENGE_LENGTH

  return (
    <svg
      viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
      width="100%"
      style={{ display: 'block' }}
      role="group"
      aria-label="Your journey, from Day 1 at the bottom to Day 75 at the top"
    >
      <JourneyScenery />

      <g aria-hidden="true" fill="none" strokeLinecap="round">
        <path d={ROAD} stroke="#000000" strokeOpacity={0.18} strokeWidth={26} />
        <path d={ROAD} stroke="#e9d9b0" strokeWidth={20} />
        <path d={ROAD} stroke="#f6ead0" strokeWidth={4} strokeDasharray="2 14" />
      </g>

      <g aria-hidden="true">
        <JourneyGates />
      </g>

      {WORLDS.map((world) => {
        const side = scenerySide(world.firstDay)
        const width = Math.max(64, world.name.length * 7.2 + 18)
        const x = side === 'left' ? width / 2 + 6 : MAP_WIDTH - width / 2 - 6
        return <JourneySign key={world.id} x={x} y={yForDay(world.firstDay) + 36} name={world.name} />
      })}

      {days.map((dayNumber) => (
        <JourneyStone
          key={dayNumber}
          x={xForDay(dayNumber)}
          y={yForDay(dayNumber)}
          dayNumber={dayNumber}
          state={stateFor(dayNumber, props)}
          world={worldForDay(dayNumber)}
          isMilestone={(MILESTONES as readonly number[]).includes(dayNumber)}
          flagWaves={props.completedDayNumbers.has(dayNumber) || dayNumber < todayDayNumber}
        />
      ))}

      {showDuck && (
        <g
          transform={`translate(${(xForDay(todayDayNumber) + (scenerySide(todayDayNumber) === 'left' ? -34 - DUCK_SIZE : 34)).toFixed(1)} ${(
            yForDay(todayDayNumber) - DUCK_SIZE + 6
          ).toFixed(1)})`}
        >
          <Mascot mood="content" size={DUCK_SIZE} decorative />
        </g>
      )}
    </svg>
  )
}

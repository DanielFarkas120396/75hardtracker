import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useEffectEvent, useState } from 'react'
import { FlameStreak } from '../../components/FlameStreak'
import { Button } from '../../components/ui/Button'
import { Mascot } from '../../components/mascot/Mascot'
import type { DayCelebration } from '../../hooks/useDayCompleteCelebration'
import { useSound } from '../../hooks/useSound'
import { CHALLENGE_LENGTH } from '../../logic/constants'
import { JourneyStone, type NodeState } from '../Journey/JourneyStone'
import { worldForDay } from '../Journey/worlds'

/** When today's stone lights up, once the burst around it has started. */
export const STONE_LIGHTS_MS = 900

const EASE_OUT = [0.16, 1, 0.3, 1] as const

interface DayCompleteCelebrationProps {
  celebration: DayCelebration | null
  onDismiss: () => void
}

/**
 * Full-screen "Day complete!" overlay, shown the moment all five tasks are done: the world's sunrise
 * behind the duck, embers rising, and a short stretch of the climb where today's stone lights up.
 */
export function DayCompleteCelebration({ celebration, onDismiss }: DayCompleteCelebrationProps) {
  const playSound = useSound()
  const visible = celebration !== null

  const onShow = useEffectEvent(() => playSound())

  useEffect(() => {
    if (visible) onShow()
  }, [visible])

  return (
    <AnimatePresence>
      {celebration && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="day-complete-title"
          className="fixed inset-0 z-50 overflow-hidden bg-canvas text-ink"
        >
          <Sunrise />
          <Embers />
          <div className="relative flex h-full flex-col items-center justify-center gap-3 px-6 pb-[env(safe-area-inset-bottom)] text-center">
            <div className="flex items-end">
              <div className="mb-8 -mr-2">
                <Mascot mood="celebrating" size={108} />
              </div>
              <ClimbStretch dayNumber={celebration.dayNumber} streak={celebration.streak} />
            </div>
            <motion.h1
              id="day-complete-title"
              className="font-display text-6xl leading-none font-semibold tracking-wide"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3, ease: EASE_OUT }}
            >
              Day {celebration.dayNumber}{' '}
              <span className="block font-rounded text-2xl font-bold tracking-normal text-world-ink">done.</span>
            </motion.h1>
            <p className="max-w-xs font-rounded font-semibold text-ink-muted">
              {celebration.isFinalDay
                ? `That was the last one. All ${CHALLENGE_LENGTH} days, every task, every day.`
                : celebration.late
                  ? 'Logged just in time. The streak lives. Now go get today.'
                  : `One more stone. ${CHALLENGE_LENGTH - celebration.dayNumber} to go.`}
            </p>
            {celebration.streak > 1 && (
              <div className="flex items-center gap-1 font-rounded font-bold">
                <FlameStreak streak={celebration.streak} grow={false} />
                <span>day streak</span>
              </div>
            )}
            <Button className="mt-3" onClick={onDismiss} autoFocus>
              {celebration.isFinalDay ? 'See your victory' : 'Nice!'}
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** The world's sunrise, swelling up behind the duck and the stones. */
function Sunrise() {
  const reduceMotion = useReducedMotion()
  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-[-30%] top-[-5%] bottom-[-15%] origin-bottom"
      style={{
        background:
          'radial-gradient(48% 38% at 50% 42%, color-mix(in srgb, var(--color-world) 50%, transparent), color-mix(in srgb, var(--color-world) 16%, transparent) 55%, transparent 78%)',
      }}
      initial={reduceMotion ? false : { opacity: 0, scaleY: 0.6 }}
      animate={{ opacity: 1, scaleY: 1 }}
      transition={{ duration: 1.4, ease: EASE_OUT }}
    />
  )
}

interface Ember {
  id: number
  left: number
  size: number
  delay: number
  duration: number
  drift: number
  tone: string
}

const EMBER_TONES = ['var(--color-world)', 'var(--color-world-ink)', 'var(--color-world-edge)']

function makeEmbers(): Ember[] {
  return Array.from({ length: 28 }, (_, id) => ({
    id,
    left: Math.random() * 100,
    size: 2 + Math.random() * 4,
    delay: Math.random() * 2,
    duration: 2.6 + Math.random() * 2.4,
    drift: (Math.random() - 0.5) * 60,
    tone: EMBER_TONES[id % EMBER_TONES.length],
  }))
}

/** Embers drifting up from the bottom in the world's shades, twice over, then gone. None under reduce motion. */
function Embers() {
  const reduceMotion = useReducedMotion()
  const [embers] = useState(makeEmbers)
  if (reduceMotion) return null
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {embers.map((ember) => (
        <motion.span
          key={ember.id}
          className="absolute bottom-0 rounded-full"
          style={{
            left: `${ember.left}%`,
            width: ember.size,
            height: ember.size,
            background: ember.tone,
            boxShadow: `0 0 ${ember.size * 3}px ${ember.size}px color-mix(in srgb, var(--color-world) 55%, transparent)`,
          }}
          initial={{ y: 20, x: 0, opacity: 0 }}
          animate={{ y: -720, x: ember.drift, opacity: [0, 1, 1, 0] }}
          transition={{ duration: ember.duration, delay: ember.delay, ease: 'easeOut', repeat: 1 }}
        />
      ))}
    </div>
  )
}

// A zigzag up the screen: two days behind below, today in the middle, two ahead above.
const ZIGZAG = [-30, 35, 0, -35, 30]
const STEP_Y = 56

/** A short stretch of the climb, with the Journey's own stones: today's lights up as the day is won. */
function ClimbStretch({ dayNumber, streak }: { dayNumber: number; streak: number }) {
  const reduceMotion = useReducedMotion()
  const [lit, setLit] = useState(reduceMotion ?? false)
  useEffect(() => {
    if (reduceMotion) return
    const timer = setTimeout(() => setLit(true), STONE_LIGHTS_MS)
    return () => clearTimeout(timer)
  }, [reduceMotion])

  const days = [-2, -1, 0, 1, 2].map((step) => dayNumber + step).filter((day) => day >= 1 && day <= CHALLENGE_LENGTH)
  const at = (day: number) => ({ x: 100 + ZIGZAG[day - dayNumber + 2], y: 150 - (day - dayNumber) * STEP_Y })
  // The streak ends today: the days it covers were won; a day behind it was forgiven with a joker.
  const stateOf = (day: number): NodeState =>
    day > dayNumber ? 'locked' : day === dayNumber ? (lit ? 'completed' : 'today') : dayNumber - day < streak ? 'completed' : 'missed'

  return (
    <svg viewBox="0 0 200 300" className="h-60 w-40 overflow-visible">
      <path
        d={days.map((day, i) => `${i === 0 ? 'M' : 'L'}${at(day).x} ${at(day).y}`).join(' ')}
        stroke="var(--color-world)"
        strokeOpacity={0.35}
        strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray="2 12"
        fill="none"
      />
      {!reduceMotion && (
        <motion.circle
          cx={at(dayNumber).x}
          cy={at(dayNumber).y}
          fill="var(--color-world)"
          initial={{ r: 10, opacity: 0 }}
          animate={{ r: [10, 70], opacity: [0.9, 0] }}
          transition={{ duration: 1.3, delay: STONE_LIGHTS_MS / 1000 - 0.2, ease: 'easeOut' }}
        />
      )}
      {days.map((day) => (
        <JourneyStone
          key={day}
          {...at(day)}
          dayNumber={day}
          state={stateOf(day)}
          world={worldForDay(day)}
          isMilestone={false}
          flagWaves={false}
        />
      ))}
    </svg>
  )
}

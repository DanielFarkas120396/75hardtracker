import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useEffectEvent, useState, type ReactNode } from 'react'
import { useHaptics } from '../../hooks/useHaptics'

interface CardProps {
  children: ReactNode
  complete?: boolean
  /** Short microcopy flashed next to the check badge when the card switches to complete. */
  cheer?: string
  className?: string
}

/** How long the cheer stays up after the card completes. */
const CHEER_VISIBLE_MS = 2500

const BURST_COLORS = ['var(--color-green)', 'var(--color-yellow)', 'var(--color-blue)', 'var(--color-orange)']
const BURST_PARTICLES = 8
const BURST_DISTANCE_PX = 28

/**
 * Rounded surface card used for each task on the Today screen; shows a check
 * badge when complete. Switching to complete — never on mount, so reopening
 * Today stays calm — pops the badge with a small burst, flashes the cheer
 * and gives a short vibration.
 */
export function Card({ children, complete = false, cheer, className = '' }: CardProps) {
  const vibrate = useHaptics()
  const reduceMotion = useReducedMotion()

  // Compare with the previous render during render (React's "adjust state
  // when a prop changes" pattern). `completions` counts switches to complete
  // since mount and keys each celebration; 0 means none yet.
  const [prevComplete, setPrevComplete] = useState(complete)
  const [completions, setCompletions] = useState(0)
  const [cheering, setCheering] = useState(false)
  if (prevComplete !== complete) {
    setPrevComplete(complete)
    setCheering(complete)
    if (complete) setCompletions((n) => n + 1)
  }

  const onCelebrate = useEffectEvent(() => vibrate(20))
  useEffect(() => {
    if (completions === 0) return
    onCelebrate()
    const timer = setTimeout(() => setCheering(false), CHEER_VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [completions])

  return (
    <div
      className={`relative rounded-card border-2 bg-surface p-4 shadow-sm motion-safe:transition-colors ${complete ? 'border-green' : 'border-transparent dark:border-white/5'} ${className}`}
    >
      {cheering && !reduceMotion && <Burst key={completions} />}
      {complete && (
        <motion.span
          initial={completions > 0 && !reduceMotion ? { scale: 0 } : false}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 14 }}
          className="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-green text-sm text-white shadow-sm"
        >
          ✓
        </motion.span>
      )}
      <div role="status" aria-live="polite" className="pointer-events-none absolute -top-1.5 right-7">
        <AnimatePresence>
          {cheering && cheer && (
            <motion.span
              key={completions}
              initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="block whitespace-nowrap rounded-full bg-green px-3 py-1 font-rounded text-xs font-extrabold text-on-accent shadow-sm"
            >
              {cheer}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      {children}
    </div>
  )
}

/** Dots that fly out once from behind the check badge. */
function Burst() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute -top-2 -right-2 h-7 w-7">
      {Array.from({ length: BURST_PARTICLES }, (_, i) => {
        const angle = (i / BURST_PARTICLES) * 2 * Math.PI
        return (
          <motion.span
            key={i}
            className="absolute inset-0 m-auto h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: BURST_COLORS[i % BURST_COLORS.length] }}
            initial={{ x: 0, y: 0, opacity: 1 }}
            animate={{ x: Math.cos(angle) * BURST_DISTANCE_PX, y: Math.sin(angle) * BURST_DISTANCE_PX, opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        )
      })}
    </span>
  )
}

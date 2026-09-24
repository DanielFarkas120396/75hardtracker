import { motion, useReducedMotion } from 'framer-motion'

interface FlameStreakProps {
  streak: number
}

/** Streak flame indicator — grows slightly and pulses as the streak increases. */
export function FlameStreak({ streak }: FlameStreakProps) {
  const reduceMotion = useReducedMotion()
  const scale = Math.min(1.5, 1 + streak * 0.02)

  return (
    <motion.div
      className="flex items-center gap-1"
      style={{ scale }}
      animate={reduceMotion ? undefined : { scale: [scale, scale * 1.05, scale] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
    >
      <span className="text-2xl" role="img" aria-label="streak">
        🔥
      </span>
      <span className="font-rounded text-lg font-extrabold text-orange">{streak}</span>
    </motion.div>
  )
}

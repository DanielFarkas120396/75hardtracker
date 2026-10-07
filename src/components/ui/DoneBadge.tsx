import { motion, useReducedMotion } from 'framer-motion'

interface DoneBadgeProps {
  /** Spring in from nothing (the task was just done), rather than simply be there. */
  pop: boolean
  className?: string
}

/** The round tick in the world colour that marks a done task. */
export function DoneBadge({ pop, className = '' }: DoneBadgeProps) {
  const reduceMotion = useReducedMotion()
  return (
    <motion.span
      aria-hidden="true"
      initial={pop && !reduceMotion ? { scale: 0 } : false}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 14 }}
      className={`flex h-7 w-7 items-center justify-center rounded-full bg-world text-sm text-on-world ${className}`}
    >
      ✓
    </motion.span>
  )
}

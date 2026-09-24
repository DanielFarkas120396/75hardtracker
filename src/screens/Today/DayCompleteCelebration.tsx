import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
import { Button } from '../../components/ui/Button'
import { celebrate } from '../../lib/confetti'

interface DayCompleteCelebrationProps {
  visible: boolean
  dayNumber: number
  onDismiss: () => void
}

export function DayCompleteCelebration({ visible, dayNumber, onDismiss }: DayCompleteCelebrationProps) {
  useEffect(() => {
    if (visible) celebrate()
  }, [visible])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-green p-6 text-center text-white"
        >
          <motion.span
            initial={{ scale: 0.6, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 16 }}
            className="text-7xl"
            role="img"
            aria-label="celebration"
          >
            🎉
          </motion.span>
          <h1 className="font-rounded text-3xl font-extrabold">Day {dayNumber} complete!</h1>
          <p className="max-w-xs font-rounded font-semibold text-white/90">
            Every task, done. See you tomorrow — keep the streak alive.
          </p>
          <Button variant="xp" className="mt-4" onClick={onDismiss}>
            Nice!
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

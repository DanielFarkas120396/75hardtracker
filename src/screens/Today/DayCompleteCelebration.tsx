import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
import { Button } from '../../components/ui/Button'
import { Mascot } from '../../components/mascot/Mascot'
import { useHaptics } from '../../hooks/useHaptics'
import { useSound } from '../../hooks/useSound'
import { celebrate } from '../../lib/confetti'

interface DayCompleteCelebrationProps {
  visible: boolean
  dayNumber: number
  xpEarned: number
  onDismiss: () => void
}

export function DayCompleteCelebration({ visible, dayNumber, xpEarned, onDismiss }: DayCompleteCelebrationProps) {
  const playSound = useSound()
  const vibrate = useHaptics()

  useEffect(() => {
    if (visible) {
      celebrate()
      playSound()
      vibrate([40, 60, 40])
    }
    // playSound/vibrate are stable per settings value, not per render
  }, [visible, playSound, vibrate])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-green p-6 text-center text-white"
        >
          <Mascot state="cheering" size={140} />
          <h1 className="font-rounded text-3xl font-extrabold">Day {dayNumber} complete!</h1>
          <p className="max-w-xs font-rounded font-semibold text-white/90">
            Every task, done. See you tomorrow — keep the streak alive.
          </p>
          <p className="font-rounded text-lg font-extrabold text-yellow">+{xpEarned} XP today</p>
          <Button variant="xp" className="mt-4" onClick={onDismiss}>
            Nice!
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useEffectEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { Mascot } from '../../components/mascot/Mascot'
import type { DayCelebration } from '../../hooks/useDayCompleteCelebration'
import { useHaptics } from '../../hooks/useHaptics'
import { useSound } from '../../hooks/useSound'
import { celebrate } from '../../lib/confetti'

interface DayCompleteCelebrationProps {
  celebration: DayCelebration | null
  onDismiss: () => void
}

/** Full-screen "Day complete!" overlay, shown the moment all five tasks are done. */
export function DayCompleteCelebration({ celebration, onDismiss }: DayCompleteCelebrationProps) {
  const playSound = useSound()
  const vibrate = useHaptics()
  const visible = celebration !== null

  const onShow = useEffectEvent(() => {
    celebrate()
    playSound()
    vibrate([40, 60, 40])
  })

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
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-green p-6 text-center text-white"
        >
          <Mascot state="cheering" size={140} />
          <h1 id="day-complete-title" className="font-rounded text-3xl font-extrabold">
            Day {celebration.dayNumber} complete!
          </h1>
          <p className="max-w-xs font-rounded font-semibold text-white/90">
            {celebration.isFinalDay
              ? 'That was the last one. All 75 days — every task, every day.'
              : 'Every task, done. See you tomorrow — keep the streak alive.'}
          </p>
          <p className="font-rounded text-lg font-extrabold text-yellow">+{celebration.xpEarned} XP today</p>
          {celebration.streak > 1 && (
            <p className="font-rounded font-bold text-white/90">🔥 {celebration.streak}-day streak</p>
          )}
          <Button variant="xp" className="mt-4" onClick={onDismiss}>
            {celebration.isFinalDay ? 'See your victory 🏆' : 'Nice!'}
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

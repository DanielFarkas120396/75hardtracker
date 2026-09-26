import { motion } from 'framer-motion'
import { useEffect, useEffectEvent, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Mascot } from '../../components/mascot/Mascot'
import { challengeRepo } from '../../db/repositories/challengeRepo'
import type { Challenge } from '../../db/types'
import { useChallengeStats } from '../../hooks/useChallengeStats'
import { useHaptics } from '../../hooks/useHaptics'
import { useSound } from '../../hooks/useSound'
import { celebrate } from '../../lib/confetti'
import { dateForDayNumber, formatDisplayDate } from '../../lib/dates'
import { CHALLENGE_LENGTH } from '../../logic/constants'

/** Attempts whose victory confetti already fired this session, so revisiting the tab stays calm. */
const celebratedThisSession = new Set<number>()

interface VictoryScreenProps {
  challenge: Challenge
  today: string
  /** False while the Day-75 celebration overlay still covers this screen; confetti waits until it's gone. */
  revealed: boolean
}

/** Shown on the Today tab once all 75 days are complete. */
export function VictoryScreen({ challenge, today, revealed }: VictoryScreenProps) {
  const stats = useChallengeStats(challenge.id)
  const playSound = useSound()
  const vibrate = useHaptics()
  const [starting, setStarting] = useState(false)

  const onReveal = useEffectEvent(() => {
    if (celebratedThisSession.has(challenge.id)) return
    celebratedThisSession.add(challenge.id)
    celebrate()
    playSound()
    vibrate([40, 60, 40, 60, 80])
  })

  useEffect(() => {
    if (revealed) onReveal()
  }, [revealed])

  const startNewChallenge = async () => {
    setStarting(true)
    try {
      await challengeRepo.startNew(today)
    } finally {
      setStarting(false)
    }
  }

  const endDate = dateForDayNumber(challenge.startDate, CHALLENGE_LENGTH)

  return (
    <div className="flex min-h-dvh flex-col items-center gap-4 bg-canvas px-6 pt-10 pb-28 text-center">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 14 }}
      >
        <Mascot mood="triumphant" size={160} />
      </motion.div>

      <div>
        <p className="font-rounded text-sm font-bold text-ink-muted">Attempt #{challenge.attemptNumber}</p>
        <h1 className="font-rounded text-3xl font-extrabold text-ink">75 Hard complete! 🏆</h1>
        <p className="mt-1 font-rounded text-sm font-semibold text-ink-muted">
          {formatDisplayDate(challenge.startDate)} – {formatDisplayDate(endDate)}
        </p>
      </div>

      <p className="max-w-xs font-rounded text-ink-muted">
        {CHALLENGE_LENGTH} days. Two workouts, the diet, the water, the reading and the photo — every single day.
        That's done now, and it's yours.
      </p>

      <div className="grid w-full max-w-sm grid-cols-2 gap-3">
        <VictoryStat label="Total XP" value={`⭐ ${stats.xp}`} />
        <VictoryStat label="Perfect days" value={`${stats.perfectDays}`} />
        <VictoryStat label="Water" value={`${(stats.water_ml / 1000).toFixed(1)} L`} />
        <VictoryStat label="Pages read" value={`${stats.pages}`} />
        <VictoryStat label="Workout time" value={`${Math.round(stats.workoutMinutes / 60)} h`} />
        <VictoryStat label="Streak" value={`🔥 ${CHALLENGE_LENGTH}`} />
      </div>

      <Button variant="primary" className="mt-2 w-full max-w-sm" onClick={() => void startNewChallenge()} disabled={starting}>
        {starting ? 'Starting…' : 'Start a new challenge'}
      </Button>
      <p className="max-w-xs font-rounded text-xs text-ink-muted">
        A new attempt starts today. Every photo and stat from this one stays saved.
      </p>
    </div>
  )
}

function VictoryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card bg-surface p-3 shadow-sm">
      <p className="font-rounded text-xs font-bold text-ink-muted">{label}</p>
      <p className="mt-1 font-rounded text-xl font-extrabold text-ink">{value}</p>
    </div>
  )
}

import { motion } from 'framer-motion'
import { useEffect, useEffectEvent, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Mascot } from '../../components/mascot/Mascot'
import { victoryLine, victoryTitle } from '../../content/variants'
import type { Challenge } from '../../db/types'
import { useChallengeStats } from '../../hooks/useChallengeStats'
import { useSound } from '../../hooks/useSound'
import { celebrate } from '../../lib/confetti'
import { dateForDayNumber, formatDisplayDate } from '../../lib/dates'
import { CHALLENGE_LENGTH } from '../../logic/constants'
import { rulesFor, variantOf } from '../../logic/rulesets'
import { NewChallengeSheet } from './NewChallengeSheet'

/** Attempts whose victory confetti already fired this session, so revisiting the tab stays calm. */
const celebratedThisSession = new Set<number>()

interface VictoryScreenProps {
  challenge: Challenge
  today: string
  /** False while the Day-75 celebration overlay still covers this screen; confetti waits until it's gone. */
  revealed: boolean
  streak: number
  missedDays: number[]
}

/** Shown on the Today tab once all 75 days are complete. */
export function VictoryScreen({ challenge, today, revealed, streak, missedDays }: VictoryScreenProps) {
  const rules = rulesFor(challenge)
  const stats = useChallengeStats(challenge.id)
  const playSound = useSound()
  const [sheetOpen, setSheetOpen] = useState(false)

  const onReveal = useEffectEvent(() => {
    if (celebratedThisSession.has(challenge.id)) return
    celebratedThisSession.add(challenge.id)
    celebrate()
    playSound()
  })

  useEffect(() => {
    if (revealed) onReveal()
  }, [revealed])

  const endDate = dateForDayNumber(challenge.startDate, CHALLENGE_LENGTH)

  return (
    <div className="flex min-h-dvh flex-col items-center gap-4 bg-canvas px-6 pt-10 pb-[calc(6.5rem+env(safe-area-inset-bottom))] text-center">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 14 }}
      >
        <Mascot mood="triumphant" size={160} />
      </motion.div>

      <div>
        <p className="font-rounded text-sm font-bold text-ink-muted">Attempt #{challenge.attemptNumber}</p>
        <h1 className="font-display text-3xl tracking-wide text-ink">{victoryTitle(rules)}</h1>
        <p className="mt-1 font-rounded text-sm font-semibold text-ink-muted">
          {formatDisplayDate(challenge.startDate)} – {formatDisplayDate(endDate)}
        </p>
      </div>

      <p className="max-w-xs font-rounded text-ink-muted">{victoryLine(rules)}</p>

      <div className="grid w-full max-w-sm grid-cols-2 gap-3">
        <VictoryStat label="Perfect days" value={`${stats.perfectDays}`} />
        <VictoryStat label="Water" value={`${(stats.water_ml / 1000).toFixed(1)} L`} />
        <VictoryStat label="Pages read" value={`${stats.pages}`} />
        <VictoryStat label="Workout time" value={`${Math.round(stats.workoutMinutes / 60)} h`} />
        <VictoryStat label="Streak" value={`🔥 ${streak}`} />
        {rules.jokers > 0 && <VictoryStat label="Jokers used" value={`${missedDays.length}/${rules.jokers}`} />}
      </div>

      <Button variant="primary" className="mt-2 w-full max-w-sm" onClick={() => setSheetOpen(true)}>
        Start a new challenge
      </Button>
      <p className="max-w-xs font-rounded text-xs text-ink-muted">Pick your next challenge and when it starts.</p>

      <NewChallengeSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        defaultVariant={variantOf(challenge)}
        today={today}
      />
    </div>
  )
}

function VictoryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card bg-surface p-3 shadow-sm">
      <p className="font-rounded text-xs font-bold text-ink-muted">{label}</p>
      <p className="mt-1 font-rounded text-xl font-bold text-ink">{value}</p>
    </div>
  )
}

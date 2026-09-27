import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Mascot } from '../../components/mascot/Mascot'
import { missedDayExplanation } from '../../content/variants'
import { challengeRepo } from '../../db/repositories/challengeRepo'
import type { Challenge } from '../../db/types'
import { rulesFor } from '../../logic/rulesets'
import { MissedTasksList } from './MissedTasksList'

interface DayFailedScreenProps {
  challenge: Challenge
  failedDayNumber: number
  today: string
}

/** Blocks the app after a missed day: shows what was missed, then restarts from Day 1 on confirmation. */
export function DayFailedScreen({ challenge, failedDayNumber, today }: DayFailedScreenProps) {
  const [restarting, setRestarting] = useState(false)

  const confirmRestart = async () => {
    setRestarting(true)
    try {
      await challengeRepo.restart(challenge.id, today)
    } catch {
      setRestarting(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas p-6 text-center">
      <Mascot mood="judging" />
      <h1 className="font-rounded text-2xl font-extrabold text-ink">Day {failedDayNumber} wasn't completed</h1>
      <p className="max-w-xs font-rounded text-ink-muted">
        {missedDayExplanation(rulesFor(challenge), challenge.attemptNumber)}
      </p>

      <MissedTasksList challenge={challenge} dayNumber={failedDayNumber} />

      <p className="mt-2 font-rounded font-bold text-ink">Again. From Day 1. I'm watching.</p>

      <Button variant="primary" className="mt-2" onClick={() => void confirmRestart()} disabled={restarting}>
        {restarting ? 'Restarting…' : 'Restart from Day 1'}
      </Button>
    </div>
  )
}

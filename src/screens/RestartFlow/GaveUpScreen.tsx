import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Mascot } from '../../components/mascot/Mascot'
import { VARIANT_NAMES } from '../../content/variants'
import type { Challenge } from '../../db/types'
import { givenUpDay } from '../../logic/attempts'
import { variantOf } from '../../logic/rulesets'
import { NewChallengeSheet } from '../Victory/NewChallengeSheet'

interface GaveUpScreenProps {
  challenge: Challenge
  today: string
}

/** Shown once the attempt was given up (Settings → Danger zone), until the next one starts. */
export function GaveUpScreen({ challenge, today }: GaveUpScreenProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const day = givenUpDay(challenge.startDate, challenge.abandonedOn)
  const variant = variantOf(challenge)

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas p-6 text-center">
      <Mascot mood="judging" />
      <h1 className="font-rounded text-2xl font-extrabold text-ink">
        {day === undefined ? 'You gave up' : `You gave up on Day ${day}`}
      </h1>
      <p className="max-w-xs font-rounded text-ink-muted">
        {VARIANT_NAMES[variant]}, attempt #{challenge.attemptNumber}. It stays in your history.
      </p>
      <p className="mt-2 font-rounded font-bold text-ink">Fine. Pick something. I'm still watching.</p>

      <Button variant="primary" className="mt-2" onClick={() => setSheetOpen(true)}>
        Start a new challenge
      </Button>
      <p className="max-w-xs font-rounded text-xs text-ink-muted">Pick your next challenge and when it starts.</p>

      <NewChallengeSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        defaultVariant={variant}
        today={today}
      />
    </div>
  )
}

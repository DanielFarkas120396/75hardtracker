import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Mascot } from '../../components/mascot/Mascot'
import { challengeRepo } from '../../db/repositories/challengeRepo'
import type { Challenge } from '../../db/types'
import { GateHeading } from './GateHeading'
import { MissedTasksList } from './MissedTasksList'

interface JokerUsedScreenProps {
  challenge: Challenge
  /** Missed days not yet announced — a subset of the attempt's full missed-day list. */
  newlyMissed: number[]
  /** Every missed day so far, announced or not — what gets acknowledged on "Keep going". */
  missedCount: number
  jokersLeft: number
}

/** "12 and 13", or "3, 4 and 5". */
function formatDayList(days: readonly number[]): string {
  if (days.length < 2) return days.join('')
  if (days.length === 2) return `${days[0]} and ${days[1]}`
  return `${days.slice(0, -1).join(', ')} and ${days[days.length - 1]}`
}

/** Announces a joker spent on one or more missed days, then acknowledges them so it isn't shown again. */
export function JokerUsedScreen({ challenge, newlyMissed, missedCount, jokersLeft }: JokerUsedScreenProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const keepGoing = async () => {
    setSaving(true)
    setError(null)
    try {
      await challengeRepo.acknowledgeJokers(challenge.id, missedCount)
    } catch {
      setSaving(false)
      setError("Couldn't save that — try again.")
    }
  }

  const heading =
    newlyMissed.length === 1
      ? `Day ${newlyMissed[0]} wasn't completed`
      : `Days ${formatDayList(newlyMissed)} weren't completed`
  const jokerLine =
    newlyMissed.length === 1
      ? `Joker used. ${jokersLeft} left.`
      : `${newlyMissed.length} jokers used. ${jokersLeft} left.`
  const duckLine = jokersLeft === 0 ? "That was your last joker. Next time, it's Day 1." : "I'll let that one go. Once."

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas p-6 text-center">
      <Mascot mood="judging" />
      <GateHeading>{heading}</GateHeading>

      {newlyMissed.map((dayNumber) => (
        <div key={dayNumber} className="w-full max-w-xs">
          {newlyMissed.length > 1 && (
            <p className="font-rounded text-xs font-bold uppercase tracking-wide text-ink-muted">Day {dayNumber}</p>
          )}
          <MissedTasksList challenge={challenge} dayNumber={dayNumber} />
        </div>
      ))}

      <p className="mt-2 font-rounded text-ink-muted">{jokerLine}</p>
      <p className="font-rounded text-ink-muted">Your streak starts over. Your challenge doesn't.</p>
      <p className="mt-2 font-rounded font-bold text-ink">{duckLine}</p>

      {error && (
        <p role="alert" className="text-sm font-semibold text-danger-ink">
          {error}
        </p>
      )}

      <Button variant="primary" className="mt-2" onClick={() => void keepGoing()} disabled={saving}>
        {saving ? 'Keeping going…' : 'Keep going'}
      </Button>
    </div>
  )
}

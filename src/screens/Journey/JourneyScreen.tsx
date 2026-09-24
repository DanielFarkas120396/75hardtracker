import { useMemo } from 'react'
import { FlameStreak } from '../../components/FlameStreak'
import type { Challenge, DayEntry } from '../../db/types'
import { useStreak } from '../../hooks/useStreak'
import { useXpTotal } from '../../hooks/useXpTotal'
import { CHALLENGE_LENGTH } from '../../logic/constants'
import { JourneyPath } from './JourneyPath'

interface JourneyScreenProps {
  challenge: Challenge
  dayEntries: DayEntry[]
  todayDayNumber: number
}

export function JourneyScreen({ challenge, dayEntries, todayDayNumber }: JourneyScreenProps) {
  const streak = useStreak(challenge.id)
  const xpTotal = useXpTotal(challenge.id)

  const completedDayNumbers = useMemo(
    () => new Set(dayEntries.filter((e) => e.completed).map((e) => e.dayNumber)),
    [dayEntries],
  )

  return (
    <div className="min-h-dvh bg-canvas pb-24">
      <header className="flex items-center justify-between px-4 pt-6 pb-2">
        <div>
          <p className="font-rounded text-sm font-bold text-ink-muted">Attempt #{challenge.attemptNumber}</p>
          <h1 className="font-rounded text-2xl font-extrabold text-ink">
            Journey — Day {todayDayNumber} / {CHALLENGE_LENGTH}
          </h1>
          <p className="mt-1 font-rounded text-sm font-extrabold text-yellow-dark">⭐ {xpTotal} XP</p>
        </div>
        <FlameStreak streak={streak} />
      </header>

      <main className="max-h-[calc(100dvh-9rem)] overflow-y-auto px-4">
        <JourneyPath completedDayNumbers={completedDayNumbers} todayDayNumber={todayDayNumber} />
      </main>
    </div>
  )
}

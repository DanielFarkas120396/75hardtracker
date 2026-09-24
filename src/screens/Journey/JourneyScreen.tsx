import { useMemo } from 'react'
import type { Challenge, DayEntry } from '../../db/types'
import { CHALLENGE_LENGTH } from '../../logic/constants'
import { JourneyPath } from './JourneyPath'

interface JourneyScreenProps {
  challenge: Challenge
  dayEntries: DayEntry[]
  todayDayNumber: number
}

export function JourneyScreen({ challenge, dayEntries, todayDayNumber }: JourneyScreenProps) {
  const completedDayNumbers = useMemo(
    () => new Set(dayEntries.filter((e) => e.completed).map((e) => e.dayNumber)),
    [dayEntries],
  )

  return (
    <div className="min-h-dvh bg-canvas pb-24">
      <header className="px-4 pt-6 pb-2">
        <p className="font-rounded text-sm font-bold text-ink-muted">Attempt #{challenge.attemptNumber}</p>
        <h1 className="font-rounded text-2xl font-extrabold text-ink">
          Journey — Day {todayDayNumber} / {CHALLENGE_LENGTH}
        </h1>
      </header>

      <main className="max-h-[calc(100dvh-9rem)] overflow-y-auto px-4">
        <JourneyPath completedDayNumbers={completedDayNumbers} todayDayNumber={todayDayNumber} />
      </main>
    </div>
  )
}

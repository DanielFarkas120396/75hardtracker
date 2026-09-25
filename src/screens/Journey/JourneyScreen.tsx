import { useMemo } from 'react'
import { FlameStreak } from '../../components/FlameStreak'
import type { Challenge, DayEntry } from '../../db/types'
import { useChallengeStats } from '../../hooks/useChallengeStats'
import { CHALLENGE_LENGTH } from '../../logic/constants'
import { daysUntilStart, isChallengeDay } from '../../logic/days'
import { JourneyPath } from './JourneyPath'

interface JourneyScreenProps {
  challenge: Challenge
  dayEntries: DayEntry[]
  todayDayNumber: number
  streak: number
  completed: boolean
}

function journeyTitle(todayDayNumber: number, completed: boolean): string {
  if (completed) return `Journey — all ${CHALLENGE_LENGTH} days!`
  if (isChallengeDay(todayDayNumber)) return `Journey — Day ${todayDayNumber} / ${CHALLENGE_LENGTH}`
  const days = daysUntilStart(todayDayNumber)
  if (days > 0) return days === 1 ? 'Journey — starts tomorrow' : `Journey — starts in ${days} days`
  return 'Journey'
}

export function JourneyScreen({ challenge, dayEntries, todayDayNumber, streak, completed }: JourneyScreenProps) {
  const { xp } = useChallengeStats(challenge.id)

  const completedDayNumbers = useMemo(
    () => new Set(dayEntries.filter((e) => e.completed).map((e) => e.dayNumber)),
    [dayEntries],
  )

  return (
    <div className="min-h-dvh bg-canvas pb-24">
      <header className="flex items-center justify-between px-4 pt-6 pb-2">
        <div>
          <p className="font-rounded text-sm font-bold text-ink-muted">Attempt #{challenge.attemptNumber}</p>
          <h1 className="font-rounded text-2xl font-extrabold text-ink">{journeyTitle(todayDayNumber, completed)}</h1>
          <p className="mt-1 font-rounded text-sm font-extrabold text-yellow-ink">⭐ {xp} XP</p>
        </div>
        <FlameStreak streak={streak} />
      </header>

      <main className="max-h-[calc(100dvh-9rem)] overflow-y-auto px-4">
        <JourneyPath
          completedDayNumbers={completedDayNumbers}
          todayDayNumber={completed ? Number.NaN : todayDayNumber}
        />
      </main>
    </div>
  )
}

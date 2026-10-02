import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { FlameStreak } from '../../components/FlameStreak'
import type { Challenge, DayEntry } from '../../db/types'
import { useChallengeStats } from '../../hooks/useChallengeStats'
import { CHALLENGE_LENGTH } from '../../logic/constants'
import { daysUntilStart, isChallengeDay } from '../../logic/days'
import { JourneyPath } from './JourneyPath'
import { MAP_HEIGHT, yForDay } from './layout'

interface JourneyScreenProps {
  challenge: Challenge
  dayEntries: DayEntry[]
  todayDayNumber: number
  streak: number
  completed: boolean
  missedDays: number[]
}

function journeyTitle(todayDayNumber: number, completed: boolean): string {
  if (completed) return `Journey — all ${CHALLENGE_LENGTH} days!`
  if (isChallengeDay(todayDayNumber)) return `Journey — Day ${todayDayNumber} / ${CHALLENGE_LENGTH}`
  const days = daysUntilStart(todayDayNumber)
  if (days > 0) return days === 1 ? 'Journey — starts tomorrow' : `Journey — starts in ${days} days`
  return 'Journey'
}

/** The day the map opens on: today, Day 1 before the start, Day 75 once it's done. */
function focusDay(todayDayNumber: number, completed: boolean): number {
  if (completed) return CHALLENGE_LENGTH
  if (isChallengeDay(todayDayNumber)) return todayDayNumber
  return 1
}

export function JourneyScreen({ challenge, dayEntries, todayDayNumber, streak, completed, missedDays }: JourneyScreenProps) {
  const { xp } = useChallengeStats(challenge.id)
  const mapRef = useRef<HTMLElement>(null)
  // Fixed on arrival: later changes to today shouldn't yank the map around.
  const [arrivalDay] = useState(() => focusDay(todayDayNumber, completed))

  // Only the map scrolls (the header stays put), opening with the arrival day in the middle.
  useLayoutEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.scrollTop = (yForDay(arrivalDay) / MAP_HEIGHT) * map.scrollHeight - map.clientHeight / 2
  }, [arrivalDay])

  const completedDayNumbers = useMemo(
    () => new Set(dayEntries.filter((e) => e.completed).map((e) => e.dayNumber)),
    [dayEntries],
  )

  return (
    <div className="flex h-dvh flex-col bg-canvas pb-[calc(4rem+env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between px-4 pt-6 pb-2">
        <div>
          <p className="font-rounded text-sm font-bold text-ink-muted">Attempt #{challenge.attemptNumber}</p>
          <h1 className="font-rounded text-2xl font-extrabold text-ink">{journeyTitle(todayDayNumber, completed)}</h1>
          <p className="mt-1 font-rounded text-sm font-extrabold text-yellow-ink">⭐ {xp} XP</p>
        </div>
        <FlameStreak streak={streak} />
      </header>

      <main ref={mapRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <JourneyPath
          completedDayNumbers={completedDayNumbers}
          missedDayNumbers={new Set(missedDays)}
          todayDayNumber={completed ? Number.NaN : todayDayNumber}
          scrollRef={mapRef}
        />
      </main>
    </div>
  )
}

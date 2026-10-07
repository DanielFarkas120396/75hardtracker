import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { FlameStreak } from '../../components/FlameStreak'
import type { Challenge, DayEntry } from '../../db/types'
import { CHALLENGE_LENGTH } from '../../logic/constants'
import { dateForDayNumber } from '../../lib/dates'
import { daysUntilStart, isChallengeDay } from '../../logic/days'
import { DayCard, type OpenDay } from './DayCard'
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
  const mapRef = useRef<HTMLElement>(null)
  // Fixed on arrival: later changes to today shouldn't yank the map around.
  const [arrivalDay] = useState(() => focusDay(todayDayNumber, completed))

  // Only the map scrolls (the header stays put), opening with the arrival day in the middle.
  useLayoutEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.scrollTop = (yForDay(arrivalDay) / MAP_HEIGHT) * map.scrollHeight - map.clientHeight / 2
  }, [arrivalDay])

  // The card keeps its day while it closes, so it shrinks back into the stone with its content.
  const [openDay, setOpenDay] = useState<OpenDay | null>(null)
  const [cardOpen, setCardOpen] = useState(false)
  const missedDayNumbers = useMemo(() => new Set(missedDays), [missedDays])
  const onOpenDay = (dayNumber: number, from: { x: number; y: number }) => {
    const entry = dayEntries.find((e) => e.dayNumber === dayNumber)
    const date = entry?.date ?? dateForDayNumber(challenge.startDate, dayNumber)
    setOpenDay({ dayNumber, date, entry, from })
    setCardOpen(true)
  }
  // The live entry, so the card follows what's logged while it's open.
  const shownDay = openDay && { ...openDay, entry: dayEntries.find((e) => e.dayNumber === openDay.dayNumber) ?? openDay.entry }

  const completedDayNumbers = useMemo(
    () => new Set(dayEntries.filter((e) => e.completed).map((e) => e.dayNumber)),
    [dayEntries],
  )

  return (
    <div className="flex h-dvh flex-col bg-canvas pb-[calc(5.25rem+env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between px-4 pt-6 pb-2">
        <div>
          <p className="font-rounded text-sm font-bold text-ink-muted">Attempt #{challenge.attemptNumber}</p>
          <h1 className="font-display text-2xl tracking-wide text-ink">{journeyTitle(todayDayNumber, completed)}</h1>
        </div>
        <FlameStreak streak={streak} />
      </header>

      <main ref={mapRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <JourneyPath
          completedDayNumbers={completedDayNumbers}
          missedDayNumbers={missedDayNumbers}
          todayDayNumber={completed ? Number.NaN : todayDayNumber}
          scrollRef={mapRef}
          onOpenDay={onOpenDay}
        />
      </main>

      <DayCard day={shownDay} open={cardOpen} onClose={() => setCardOpen(false)} />
    </div>
  )
}

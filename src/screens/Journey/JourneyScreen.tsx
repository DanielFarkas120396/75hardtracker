import { useReducedMotionConfig } from 'framer-motion'
import { useMemo, useState, type CSSProperties } from 'react'
import { FlameStreak } from '../../components/FlameStreak'
import { Icon } from '../../components/icons/Icon'
import type { Challenge, DayEntry } from '../../db/types'
import { dateForDayNumber, formatShortDay } from '../../lib/dates'
import { CHALLENGE_LENGTH } from '../../logic/constants'
import { ClimbCard } from '../Stats/ClimbCard'
import { AltitudeRail } from './AltitudeRail'
import { coverId, journeyLog, type Chapter } from './chapters'
import { DayCard, type OpenDay } from './DayCard'
import { DayRow } from './DayRow'
import { WorldCover } from './WorldCover'
import type { World } from './worlds'

interface JourneyScreenProps {
  challenge: Challenge
  dayEntries: DayEntry[]
  todayDayNumber: number
  streak: number
  completed: boolean
  missedDays: number[]
}

/** The cover closing a chapter: its score while you're in it, "Cleared" with the date once it's behind you. */
function chapterCover(chapter: Chapter, startDate: string, todayDone: boolean) {
  const { world, done, jokers, cleared } = chapter
  const length = world.lastDay - world.firstDay + 1
  const days = `Days ${world.firstDay}–${world.lastDay}`
  if (!cleared) {
    // Today still counts as to go until it's done.
    const toGo = world.lastDay - chapter.days[0].dayNumber + (chapter.days[0].status === 'today' && !todayDone ? 1 : 0)
    return { badge: `${done}/${length}`, detail: toGo > 0 ? `${days} · ${toGo} to go` : days }
  }
  const jokerNote = jokers > 0 ? ` · ${jokers} ${jokers === 1 ? 'joker' : 'jokers'}` : ''
  return { badge: 'Cleared', detail: `${days} · ${done}/${length}${jokerNote} · done ${formatShortDay(dateForDayNumber(startDate, world.lastDay))}` }
}

/**
 * The Journey as a logbook: the attempt's days, newest first, in chapters
 * by world (each under its cover, in its colours), the next world waiting
 * locked on top, and the climb as a rail down the left edge. Tapping a day
 * opens its card: photo, notes, workouts.
 */
export function JourneyScreen({ challenge, dayEntries, todayDayNumber, streak, completed, missedDays }: JourneyScreenProps) {
  const reduceMotion = useReducedMotionConfig() ?? false
  const dayReached = completed ? CHALLENGE_LENGTH : todayDayNumber

  const log = useMemo(
    () =>
      journeyLog({
        todayDayNumber,
        completed,
        completedDays: new Set(dayEntries.filter((e) => e.completed).map((e) => e.dayNumber)),
        missedDays: new Set(missedDays),
        restoredDays: new Set(challenge.restoredDays ?? []),
      }),
    [todayDayNumber, completed, dayEntries, missedDays, challenge.restoredDays],
  )

  // The card keeps its day while it closes, so it shrinks back into the row with its content.
  const [openDay, setOpenDay] = useState<OpenDay | null>(null)
  const [cardOpen, setCardOpen] = useState(false)
  const entryFor = (dayNumber: number) => dayEntries.find((e) => e.dayNumber === dayNumber)
  const dateFor = (dayNumber: number) => entryFor(dayNumber)?.date ?? dateForDayNumber(challenge.startDate, dayNumber)
  const onOpenDay = (dayNumber: number, from: { x: number; y: number }) => {
    setOpenDay({ dayNumber, date: dateFor(dayNumber), entry: entryFor(dayNumber), from, restored: challenge.restoredDays?.includes(dayNumber) })
    setCardOpen(true)
  }
  // The live entry, so the card follows what's logged while it's open.
  const shownDay = openDay && { ...openDay, entry: entryFor(openDay.dayNumber) ?? openDay.entry }

  // A world reached jumps to its cover; one ahead, to the top, where the next world waits.
  const onJump = (world: World) => {
    const behavior = reduceMotion ? 'auto' : 'smooth'
    const cover = world.firstDay <= dayReached ? document.getElementById(coverId(world)) : null
    window.scrollTo({ top: cover ? cover.getBoundingClientRect().top + window.scrollY - 24 : 0, behavior })
  }

  return (
    <div
      className="min-h-dvh bg-canvas pb-[calc(6.5rem+env(safe-area-inset-bottom))]"
      // Read here, before each chapter's data-world swaps in a canvas of its own.
      style={{ '--journey-canvas': 'var(--color-canvas)' } as CSSProperties}
    >
      <header className="flex items-center justify-between pt-6 pr-4 pb-4 pl-10">
        <div>
          <p className="font-rounded text-sm font-semibold text-ink-muted">Attempt #{challenge.attemptNumber}</p>
          <h1 className="flex items-center gap-2 font-display text-2xl font-semibold tracking-wide text-ink">
            <Icon name="journey" className="text-world-ink" />
            Journey
          </h1>
        </div>
        <FlameStreak streak={streak} />
      </header>

      <AltitudeRail dayReached={dayReached} onJump={onJump} />

      <main className="flex flex-col gap-2 pr-4 pl-10">
        <ClimbCard dayReached={dayReached} />

        {log.next && (
          <div className="mt-4">
            <WorldCover
              world={log.next.world}
              locked
              badge={log.next.inDays === 1 ? 'Tomorrow' : `In ${log.next.inDays} days`}
              detail={`Days ${log.next.world.firstDay}–${log.next.world.lastDay}`}
            />
          </div>
        )}

        {log.chapters.map((chapter) => (
          <section key={chapter.world.id} aria-label={chapter.world.name} className="mt-4 flex flex-col gap-2">
            <WorldCover world={chapter.world} {...chapterCover(chapter, challenge.startDate, Boolean(entryFor(todayDayNumber)?.completed))} />
            {chapter.days.map(({ dayNumber, status }) => (
              <DayRow
                key={dayNumber}
                dayNumber={dayNumber}
                date={dateFor(dayNumber)}
                status={status}
                world={chapter.world.id}
                entry={entryFor(dayNumber)}
                onOpen={(from) => onOpenDay(dayNumber, from)}
              />
            ))}
          </section>
        ))}
      </main>

      <DayCard day={shownDay} open={cardOpen} onClose={() => setCardOpen(false)} />
    </div>
  )
}

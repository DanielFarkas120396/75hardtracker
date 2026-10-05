import { useState } from 'react'
import { Icon } from '../../components/icons/Icon'
import type { BoardTask } from '../../content/taskStatus'
import type { Challenge, DayEntry } from '../../db/types'
import { useCurrentBook } from '../../hooks/useCurrentBook'
import { useDayCompletion } from '../../hooks/useDayCompletion'
import { useEntryPhoto } from '../../hooks/useEntryPhoto'
import { useTodayEntry } from '../../hooks/useTodayEntry'
import { useWorkoutsForEntry } from '../../hooks/useWorkoutsForEntry'
import { challengeWeek, rulesFor } from '../../logic/rulesets'
import { DayBoard } from './DayBoard'
import { PhotoCapture } from './PhotoCapture'
import { TaskSheet } from './TaskSheet'
import { describeTask } from './taskSheets'

/** On Today, under the hero: yesterday isn't finished, and there's until noon to log it. */
export function LateDayCard({ dayNumber, onOpen }: { dayNumber: number; onOpen: () => void }) {
  return (
    <section className="mx-4 mb-4 flex items-center gap-3 rounded-card border-2 border-world bg-surface p-4 shadow-sm">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-world-soft text-world-ink">
        <Icon name="history" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="font-rounded font-extrabold text-ink">Day {dayNumber} isn't finished</h2>
        <p className="font-rounded text-sm text-ink-muted">Forgot to log it? You have until 12:00.</p>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="min-h-touch shrink-0 rounded-2xl border-b-4 border-world-edge bg-world px-4 font-rounded text-sm font-bold text-on-world active:translate-y-1 active:border-b-0"
      >
        Finish it
      </button>
    </section>
  )
}

interface LateDayViewProps {
  challenge: Challenge
  dayEntries: DayEntry[]
  dayNumber: number
  /** The late day's date (yesterday). */
  date: string
  /** Back to today; absent when there's no today to go back to (the morning after Day 75). */
  onBack?: () => void
}

/**
 * Yesterday's tasks, to finish logging them before noon: the same board as
 * Today, without the duck or the plan, and a photo only from the library.
 */
export function LateDayView({ challenge, dayEntries, dayNumber, date, onBack }: LateDayViewProps) {
  const rules = rulesFor(challenge)
  const entry = useTodayEntry({ challengeId: challenge.id, dayNumber, today: date, dayEntries })
  const workouts = useWorkoutsForEntry(entry?.id)
  const completion = useDayCompletion(entry, workouts, rules, challenge.socialDays)
  const { currentBook } = useCurrentBook()
  const photo = useEntryPhoto(entry?.photoId)
  const [openTask, setOpenTask] = useState<BoardTask | null>(null)

  if (!entry || !workouts || !completion) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas">
        <p className="font-rounded text-ink-muted">Loading…</p>
      </div>
    )
  }

  const socialThatDay = rules.socialDaysPerWeek > 0 && (challenge.socialDays?.includes(dayNumber) ?? false)
  const weekRestDay = dayEntries.find(
    (e) => e.restDay && e.dayNumber !== dayNumber && challengeWeek(e.dayNumber) === challengeWeek(dayNumber),
  )?.dayNumber

  const sheetContext = {
    entry,
    workouts,
    completion: completion.completion,
    rules,
    dayNumber,
    socialToday: socialThatDay,
    canPlanSocial: false,
    onPlanSocial: () => {},
    weekRestDay,
    libraryOnly: true,
  }

  return (
    <PhotoCapture entry={entry} libraryOnly onCameraOpen={() => setOpenTask(null)}>
      <div className="min-h-dvh bg-canvas pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
        <header className="px-4 pt-4 pb-4">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="-ml-2 flex min-h-touch items-center gap-1 rounded-xl px-2 font-rounded font-bold text-world-ink"
            >
              <Icon name="chevron" size={18} className="rotate-180" />
              Today
            </button>
          )}
          <p className={`font-rounded text-sm font-bold text-ink-muted ${onBack ? '' : 'pt-2'}`}>Yesterday</p>
          <h1 className="font-display text-3xl tracking-wide text-world-ink">Finish Day {dayNumber}</h1>
          <p className="mt-1 font-rounded text-sm text-ink-muted">
            Log what you did yesterday. You have until 12:00; after that, the day counts as missed.
          </p>
        </header>

        <main className="px-4">
          <DayBoard
            entry={entry}
            data={completion.data}
            completion={completion.completion}
            missing={completion.missing}
            rules={rules}
            currentBook={currentBook}
            photo={photo?.blob}
            onOpen={setOpenTask}
          />
        </main>

        <TaskSheet content={openTask ? describeTask(openTask, sheetContext) : null} onClose={() => setOpenTask(null)} />
      </div>
    </PhotoCapture>
  )
}

import { Icon } from '../../components/icons/Icon'
import { taskCheer } from '../../content/microcopy'
import type { Challenge, DayEntry } from '../../db/types'
import { useDayCompletion } from '../../hooks/useDayCompletion'
import { useTodayEntry } from '../../hooks/useTodayEntry'
import { useWorkoutsForEntry } from '../../hooks/useWorkoutsForEntry'
import { challengeWeek, rulesFor } from '../../logic/rulesets'
import { DayNotesCard } from './DayNotesCard'
import { DietCard } from './DietCard'
import { PhotoCard } from './PhotoCard'
import { ReadingCard } from './ReadingCard'
import { WaterCard } from './WaterCard'
import { WorkoutCard } from './WorkoutCard'

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
 * Yesterday's tasks, to finish logging them before noon: the same cards as
 * Today, without the duck or the plan, and a photo only from the library.
 */
export function LateDayView({ challenge, dayEntries, dayNumber, date, onBack }: LateDayViewProps) {
  const rules = rulesFor(challenge)
  const entry = useTodayEntry({ challengeId: challenge.id, dayNumber, today: date, dayEntries })
  const workouts = useWorkoutsForEntry(entry?.id)
  const completion = useDayCompletion(entry, workouts, rules, challenge.socialDays)

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

  return (
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

      <main className="flex flex-col gap-4 px-4">
        <WorkoutCard
          dayEntryId={entry.id}
          workouts={workouts}
          complete={completion.completion.workouts}
          cheer={taskCheer('workouts', dayNumber, rules)}
          rules={rules}
          restDay={entry.restDay === true}
          weekRestDay={weekRestDay}
        />
        <DietCard
          entry={entry}
          complete={completion.completion.diet}
          cheer={taskCheer('diet', dayNumber, rules)}
          rules={rules}
          socialToday={socialThatDay}
          canPlanSocial={false}
          onPlanSocial={() => {}}
        />
        <WaterCard entry={entry} complete={completion.completion.water} cheer={taskCheer('water', dayNumber, rules)} rules={rules} />
        <ReadingCard
          entry={entry}
          complete={completion.completion.reading}
          cheer={taskCheer('reading', dayNumber, rules)}
          rules={rules}
        />
        <PhotoCard entry={entry} complete={completion.completion.photo} cheer={taskCheer('photo', dayNumber, rules)} libraryOnly />
        <DayNotesCard entry={entry} />
      </main>
    </div>
  )
}

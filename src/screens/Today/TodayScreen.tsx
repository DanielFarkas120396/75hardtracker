import { FlameStreak } from '../../components/FlameStreak'
import { ProgressRing } from '../../components/ui/ProgressRing'
import type { Challenge, DayEntry } from '../../db/types'
import { useDayCompletion } from '../../hooks/useDayCompletion'
import { useTodayEntry } from '../../hooks/useTodayEntry'
import { useWorkoutsForEntry } from '../../hooks/useWorkoutsForEntry'
import { useXpTotal } from '../../hooks/useXpTotal'
import { CHALLENGE_LENGTH } from '../../logic/constants'
import { TASK_IDS } from '../../logic/dayCompletion'
import { isChallengeDay } from '../../logic/days'
import { DayNotesCard } from './DayNotesCard'
import { DietCard } from './DietCard'
import { PhotoCard } from './PhotoCard'
import { PreStartView } from './PreStartView'
import { ReadingCard } from './ReadingCard'
import { WaterCard } from './WaterCard'
import { WorkoutCard } from './WorkoutCard'

interface TodayScreenProps {
  challenge: Challenge
  dayEntries: DayEntry[]
  today: string
  todayDayNumber: number
  streak: number
}

export function TodayScreen(props: TodayScreenProps) {
  if (!isChallengeDay(props.todayDayNumber)) {
    return <PreStartView challenge={props.challenge} todayDayNumber={props.todayDayNumber} />
  }
  return <TodayTasks {...props} />
}

function TodayTasks({ challenge, dayEntries, today, todayDayNumber, streak }: TodayScreenProps) {
  const entry = useTodayEntry({ challengeId: challenge.id, dayNumber: todayDayNumber, today, dayEntries })
  const workouts = useWorkoutsForEntry(entry?.id)
  const completion = useDayCompletion(entry, workouts)
  const xpTotal = useXpTotal(challenge.id)

  if (!entry || !workouts || !completion) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas">
        <p className="font-rounded text-ink-muted">Loading…</p>
      </div>
    )
  }

  const completedCount = Object.values(completion.completion).filter(Boolean).length

  return (
    <div className="min-h-dvh bg-canvas pb-24">
      <header className="flex items-center justify-between px-4 pt-6 pb-4">
        <div>
          <p className="font-rounded text-sm font-bold text-ink-muted">Attempt #{challenge.attemptNumber}</p>
          <h1 className="font-rounded text-2xl font-extrabold text-ink">
            Day {todayDayNumber} / {CHALLENGE_LENGTH}
          </h1>
          <p className="mt-1 font-rounded text-sm font-extrabold text-yellow-dark">⭐ {xpTotal} XP</p>
        </div>
        <div className="flex items-center gap-3">
          <FlameStreak streak={streak} />
          <ProgressRing value={completedCount} max={TASK_IDS.length}>
            <span className="font-rounded text-sm font-extrabold text-ink">{completedCount}/{TASK_IDS.length}</span>
          </ProgressRing>
        </div>
      </header>

      <main className="flex flex-col gap-4 px-4">
        <WorkoutCard dayEntryId={entry.id} workouts={workouts} complete={completion.completion.workouts} />
        <DietCard entry={entry} complete={completion.completion.diet} />
        <WaterCard entry={entry} complete={completion.completion.water} />
        <ReadingCard entry={entry} complete={completion.completion.reading} />
        <PhotoCard entry={entry} complete={completion.completion.photo} />
        <DayNotesCard entry={entry} />
      </main>
    </div>
  )
}

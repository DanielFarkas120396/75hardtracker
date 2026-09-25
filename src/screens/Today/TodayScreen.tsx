import { FlameStreak } from '../../components/FlameStreak'
import { Mascot } from '../../components/mascot/Mascot'
import { ProgressRing } from '../../components/ui/ProgressRing'
import { mascotLine, taskCheer } from '../../content/microcopy'
import type { Challenge, DayEntry } from '../../db/types'
import { useChallengeStats } from '../../hooks/useChallengeStats'
import { useDayCompletion } from '../../hooks/useDayCompletion'
import { useTodayEntry } from '../../hooks/useTodayEntry'
import { useWorkoutsForEntry } from '../../hooks/useWorkoutsForEntry'
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
  const { xp } = useChallengeStats(challenge.id)

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
          <p className="mt-1 font-rounded text-sm font-extrabold text-yellow-dark">⭐ {xp} XP</p>
        </div>
        <div className="flex items-center gap-3">
          <FlameStreak streak={streak} />
          <ProgressRing value={completedCount} max={TASK_IDS.length}>
            <span className="font-rounded text-sm font-extrabold text-ink">{completedCount}/{TASK_IDS.length}</span>
          </ProgressRing>
        </div>
      </header>

      <div className="flex items-center gap-3 px-4 pb-4">
        {/* Decorative: the speech bubble carries the message. */}
        <div aria-hidden="true" className="shrink-0">
          <Mascot state={completion.isComplete ? 'cheering' : 'idle'} size={64} />
        </div>
        <p className="relative rounded-2xl bg-surface px-4 py-2 font-rounded text-sm font-bold text-ink shadow-sm">
          <span aria-hidden="true" className="absolute top-1/2 -left-1.5 h-3 w-3 -translate-y-1/2 rotate-45 bg-surface" />
          {mascotLine(completion.missing)}
        </p>
      </div>

      <main className="flex flex-col gap-4 px-4">
        <WorkoutCard
          dayEntryId={entry.id}
          workouts={workouts}
          complete={completion.completion.workouts}
          cheer={taskCheer('workouts', todayDayNumber)}
        />
        <DietCard entry={entry} complete={completion.completion.diet} cheer={taskCheer('diet', todayDayNumber)} />
        <WaterCard entry={entry} complete={completion.completion.water} cheer={taskCheer('water', todayDayNumber)} />
        <ReadingCard
          entry={entry}
          complete={completion.completion.reading}
          cheer={taskCheer('reading', todayDayNumber)}
        />
        <PhotoCard entry={entry} complete={completion.completion.photo} cheer={taskCheer('photo', todayDayNumber)} />
        <DayNotesCard entry={entry} />
      </main>
    </div>
  )
}

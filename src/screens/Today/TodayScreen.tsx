import { useState } from 'react'
import { FlameStreak } from '../../components/FlameStreak'
import { ProgressRing } from '../../components/ui/ProgressRing'
import { planSavedLine, taskCheer } from '../../content/microcopy'
import type { Challenge, DayEntry } from '../../db/types'
import { useChallengeStats } from '../../hooks/useChallengeStats'
import { useDayCompletion } from '../../hooks/useDayCompletion'
import { useMenace } from '../../hooks/useMenace'
import { useNow } from '../../hooks/useNow'
import { useTodayEntry } from '../../hooks/useTodayEntry'
import { useWorkoutsForEntry } from '../../hooks/useWorkoutsForEntry'
import { CHALLENGE_LENGTH } from '../../logic/constants'
import { TASK_IDS } from '../../logic/dayCompletion'
import { isChallengeDay } from '../../logic/days'
import { DayNotesCard } from './DayNotesCard'
import { DietCard } from './DietCard'
import { DuckHeader, type DuckAnnouncement } from './DuckHeader'
import { MenaceAtmosphere } from './MenaceAtmosphere'
import { PhotoCard } from './PhotoCard'
import { PlanSheet } from './PlanSheet'
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
  // Keyed by day: the lunges, the plan sheet and the announcement all belong to one day.
  return <TodayTasks key={props.todayDayNumber} {...props} />
}

function TodayTasks({ challenge, dayEntries, today, todayDayNumber, streak }: TodayScreenProps) {
  const entry = useTodayEntry({ challengeId: challenge.id, dayNumber: todayDayNumber, today, dayEntries })
  const workouts = useWorkoutsForEntry(entry?.id)
  const completion = useDayCompletion(entry, workouts)
  const nowMin = useNow()
  const menace = useMenace(completion?.data, entry, nowMin)
  const { xp } = useChallengeStats(challenge.id)
  const [lunges, setLunges] = useState(0)
  const [planOpen, setPlanOpen] = useState(false)
  const [announcement, setAnnouncement] = useState<DuckAnnouncement>()

  if (!entry || !workouts || !completion || !menace) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas">
        <p className="font-rounded text-ink-muted">Loading…</p>
      </div>
    )
  }

  const completedCount = Object.values(completion.completion).filter(Boolean).length

  return (
    <div className="min-h-dvh bg-canvas pb-24">
      <MenaceAtmosphere level={menace.level} flashes={lunges} />
      <div className="relative z-10">
        <header className="flex items-center justify-between px-4 pt-6 pb-4">
          <div>
            <p className="font-rounded text-sm font-bold text-ink-muted">Attempt #{challenge.attemptNumber}</p>
            <h1 className="font-rounded text-2xl font-extrabold text-ink">
              Day {todayDayNumber} / {CHALLENGE_LENGTH}
            </h1>
            <p className="mt-1 font-rounded text-sm font-extrabold text-yellow-ink">⭐ {xp} XP</p>
          </div>
          <div className="flex items-center gap-3">
            <FlameStreak streak={streak} />
            <ProgressRing value={completedCount} max={TASK_IDS.length}>
              <span className="font-rounded text-sm font-extrabold text-ink">
                {completedCount}/{TASK_IDS.length}
              </span>
            </ProgressRing>
          </div>
        </header>

        <DuckHeader
          menace={menace}
          missing={completion.missing}
          completion={completion.completion}
          dayNumber={todayDayNumber}
          announcement={announcement}
          onLunge={() => setLunges((count) => count + 1)}
        >
          {completion.missing.length > 0 && (
            <button
              type="button"
              onClick={() => setPlanOpen(true)}
              className="min-h-touch rounded-2xl bg-surface px-4 font-rounded text-sm font-bold text-ink shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              🗓 {completion.missing.some((task) => entry.plans?.[task]) ? 'Edit plan' : "I've got a plan"}
            </button>
          )}
        </DuckHeader>

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

      <PlanSheet
        open={planOpen}
        entry={entry}
        data={completion.data}
        missing={completion.missing}
        nowMin={nowMin}
        onClose={() => setPlanOpen(false)}
        onSaved={(earliest) => {
          setPlanOpen(false)
          if (earliest !== null) {
            setAnnouncement((previous) => ({ text: planSavedLine(earliest), reaction: 'relax', id: (previous?.id ?? 0) + 1 }))
          }
        }}
      />
    </div>
  )
}

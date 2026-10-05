import { useState } from 'react'
import { BackupReminderBanner } from '../../components/BackupReminderBanner'
import { LockBypassBanner } from '../../components/LockBypassBanner'
import { WhyQuote } from '../../components/ProfileLines'
import { planSavedLine } from '../../content/microcopy'
import type { BoardTask } from '../../content/taskStatus'
import { VARIANT_NAMES } from '../../content/variants'
import type { Challenge, DayEntry } from '../../db/types'
import { useCurrentBook } from '../../hooks/useCurrentBook'
import { useDayCompletion } from '../../hooks/useDayCompletion'
import { useEntryPhoto } from '../../hooks/useEntryPhoto'
import { useMenace } from '../../hooks/useMenace'
import { useNow } from '../../hooks/useNow'
import { useProfile } from '../../hooks/useProfile'
import { useTodayEntry } from '../../hooks/useTodayEntry'
import { useWorkoutsForEntry } from '../../hooks/useWorkoutsForEntry'
import { addDaysISO, dateForDayNumber, formatWeekday } from '../../lib/dates'
import { CHALLENGE_LENGTH } from '../../logic/constants'
import { TASK_IDS } from '../../logic/dayCompletion'
import { isChallengeDay } from '../../logic/days'
import { challengeWeek, rulesFor } from '../../logic/rulesets'
import { isStartDateEditable } from '../../logic/startDate'
import { DayBoard } from './DayBoard'
import { DuckHeader, type DuckAnnouncement } from './DuckHeader'
import { LateDayCard, LateDayView } from './LateDay'
import { MenaceAtmosphere } from './MenaceAtmosphere'
import { PhotoCapture } from './PhotoCapture'
import { PlanSheet } from './PlanSheet'
import { PreStartView } from './PreStartView'
import { SocialOccasionSheet } from './SocialOccasionSheet'
import { TaskSheet } from './TaskSheet'
import { describeTask } from './taskSheets'
import { TodayHero } from './TodayHero'

interface TodayScreenProps {
  challenge: Challenge
  dayEntries: DayEntry[]
  today: string
  todayDayNumber: number
  streak: number
  jokersLeft: number
  /** Open the camera on arrival (from the Gallery), then call onCameraOpened. */
  openCamera?: boolean
  onCameraOpened?: () => void
  /** Yesterday, while it can still be finished (until noon) and isn't yet. */
  pendingLateDay?: number | null
}

export function TodayScreen(props: TodayScreenProps) {
  const [lateOpen, setLateOpen] = useState(false)
  const late = props.pendingLateDay ?? null

  // The morning after Day 75 there's no today to show: only the last day to finish.
  if (late !== null && (lateOpen || !isChallengeDay(props.todayDayNumber))) {
    return (
      <LateDayView
        key={late}
        challenge={props.challenge}
        dayEntries={props.dayEntries}
        dayNumber={late}
        date={addDaysISO(props.today, -1)}
        onBack={isChallengeDay(props.todayDayNumber) ? () => setLateOpen(false) : undefined}
      />
    )
  }
  if (!isChallengeDay(props.todayDayNumber)) {
    return <PreStartView challenge={props.challenge} todayDayNumber={props.todayDayNumber} today={props.today} />
  }
  // Keyed by day: the lunges, the sheets and the announcement all belong to one day.
  return <TodayTasks key={props.todayDayNumber} {...props} onOpenLateDay={() => setLateOpen(true)} />
}

function TodayTasks({
  challenge,
  dayEntries,
  today,
  todayDayNumber,
  streak,
  jokersLeft,
  openCamera,
  onCameraOpened,
  pendingLateDay,
  onOpenLateDay,
}: TodayScreenProps & { onOpenLateDay: () => void }) {
  const rules = rulesFor(challenge)
  const entry = useTodayEntry({ challengeId: challenge.id, dayNumber: todayDayNumber, today, dayEntries })
  const workouts = useWorkoutsForEntry(entry?.id)
  const completion = useDayCompletion(entry, workouts, rules, challenge.socialDays)
  const nowMin = useNow()
  const menace = useMenace(completion?.data, entry, nowMin, rules)
  const profile = useProfile()
  const { currentBook } = useCurrentBook()
  const photo = useEntryPhoto(entry?.photoId)
  const [lunges, setLunges] = useState(0)
  const [planOpen, setPlanOpen] = useState(false)
  const [socialOpen, setSocialOpen] = useState(false)
  const [openTask, setOpenTask] = useState<BoardTask | null>(null)
  const [announcement, setAnnouncement] = useState<DuckAnnouncement>()

  if (!entry || !workouts || !completion || !menace) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas">
        <p className="font-rounded text-ink-muted">Loading…</p>
      </div>
    )
  }

  const completedCount = Object.values(completion.completion).filter(Boolean).length
  const socialToday = rules.socialDaysPerWeek > 0 && (challenge.socialDays?.includes(todayDayNumber) ?? false)
  const weekRestDay = dayEntries.find(
    (e) => e.restDay && e.dayNumber !== todayDayNumber && challengeWeek(e.dayNumber) === challengeWeek(todayDayNumber),
  )?.dayNumber

  const sheetContext = {
    entry,
    workouts,
    completion: completion.completion,
    rules,
    dayNumber: todayDayNumber,
    socialToday,
    canPlanSocial: rules.socialDaysPerWeek > 0 && todayDayNumber < CHALLENGE_LENGTH,
    onPlanSocial: () => {
      setOpenTask(null)
      setSocialOpen(true)
    },
    weekRestDay,
    libraryOnly: false,
  }

  return (
    <PhotoCapture
      entry={entry}
      openCameraNow={openCamera}
      onCameraOpened={onCameraOpened}
      onCameraOpen={() => setOpenTask(null)}
    >
      <div className="min-h-dvh bg-canvas pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
        <MenaceAtmosphere level={menace.level} flashes={lunges} />
        <div className="relative z-10">
          <TodayHero
            attemptLine={`${VARIANT_NAMES[rules.variant]} · Attempt #${challenge.attemptNumber}`}
            dayNumber={todayDayNumber}
            completedCount={completedCount}
            taskCount={TASK_IDS.length}
            streak={streak}
            jokersLeft={rules.jokers > 0 ? jokersLeft : undefined}
          />
          {pendingLateDay != null && <LateDayCard dayNumber={pendingLateDay} onOpen={onOpenLateDay} />}
          <LockBypassBanner />
          <BackupReminderBanner />

          {isStartDateEditable(todayDayNumber) && (
            <p className="px-4 pb-2 font-rounded text-xs text-ink-muted">
              Doing {VARIANT_NAMES[rules.variant]}. You can switch challenge in Settings until the end of Day 1.
            </p>
          )}

          <DuckHeader
            menace={menace}
            missing={completion.missing}
            completion={completion.completion}
            dayNumber={todayDayNumber}
            announcement={announcement}
            name={profile?.name}
            onLunge={() => setLunges((count) => count + 1)}
          >
            {completion.missing.length > 0 && (
              <button
                type="button"
                onClick={() => setPlanOpen(true)}
                className="min-h-touch rounded-2xl bg-surface px-4 font-rounded text-sm font-bold text-ink shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                🗓️ {completion.missing.some((task) => entry.plans?.[task]) ? 'Edit plan' : "I've got a plan"}
              </button>
            )}
          </DuckHeader>
          <WhyQuote className="px-4 pb-4" />

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
        </div>

        <TaskSheet content={openTask ? describeTask(openTask, sheetContext) : null} onClose={() => setOpenTask(null)} />

        <PlanSheet
          open={planOpen}
          entry={entry}
          data={completion.data}
          missing={completion.missing}
          nowMin={nowMin}
          rules={rules}
          onClose={() => setPlanOpen(false)}
          onSaved={(earliest) => {
            setPlanOpen(false)
            if (earliest !== null) {
              setAnnouncement((previous) => ({ text: planSavedLine(earliest), reaction: 'relax', id: (previous?.id ?? 0) + 1 }))
            }
          }}
        />

        <SocialOccasionSheet
          open={socialOpen}
          challenge={challenge}
          today={today}
          todayDayNumber={todayDayNumber}
          onClose={() => setSocialOpen(false)}
          onDeclared={(dayNumber) =>
            setAnnouncement((previous) => ({
              text: `${formatWeekday(dateForDayNumber(challenge.startDate, dayNumber))}. One drink. I'm counting.`,
              reaction: 'relax',
              id: (previous?.id ?? 0) + 1,
            }))
          }
        />
      </div>
    </PhotoCapture>
  )
}

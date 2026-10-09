import { LayoutGroup, motion, useReducedMotion } from 'framer-motion'
import { useState } from 'react'
import { BackupReminderBanner } from '../../components/BackupReminderBanner'
import { LockBypassBanner } from '../../components/LockBypassBanner'
import { planReminderLine, planSavedLine, timeLeftLine } from '../../content/microcopy'
import { notesStatusLine } from '../../content/taskStatus'
import type { BoardTask } from '../../content/taskStatus'
import { VARIANT_NAMES } from '../../content/variants'
import type { Challenge, DayEntry } from '../../db/types'
import type { Menace } from '../../logic/menace'
import type { DayTaskData, TaskId } from '../../logic/types'
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
import { AddWorkoutSheet } from './AddWorkoutSheet'
import { DayBoard } from './DayBoard'
import { useDuck, type DuckAnnouncement } from './DuckHeader'
import { LateDayCard, LateDayView } from './LateDay'
import { MenaceAtmosphere } from './MenaceAtmosphere'
import { PhotoCapture } from './PhotoCapture'
import { PlanSheet } from './PlanSheet'
import { PreStartView } from './PreStartView'
import { SocialOccasionSheet } from './SocialOccasionSheet'
import { TaskSheet } from './TaskSheet'
import { describeTask } from './taskSheets'
import { TodayHero } from './TodayHero'

/** The labelled buttons under the board, in thumb reach: the evening plan, the social night, the notes. Each stays on one line. */
const ACTION_BUTTON =
  'flex min-h-touch flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-surface px-3 font-rounded text-sm font-bold text-ink ring-1 ring-ink/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink dark:ring-0'

/** Late in the evening with tasks left: the duck is tapping or hunting. */
function isUrgent(menace: Menace, missing: readonly TaskId[]): boolean {
  return missing.length > 0 && (menace.level === 'tapping' || menace.level === 'hunting')
}

/** Something is logged today, even if no task is done yet. */
function hasStarted(data: DayTaskData): boolean {
  return (
    data.workouts.length > 0 ||
    data.water_ml > 0 ||
    data.pages_read > 0 ||
    data.dietFollowed ||
    data.noAlcohol ||
    data.hasPhoto ||
    data.restDay === true
  )
}

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
  /** The "Day complete!" overlay is up over this screen. */
  celebrating?: boolean
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
  celebrating,
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
  const [addWorkoutOpen, setAddWorkoutOpen] = useState(false)
  const [announcement, setAnnouncement] = useState<DuckAnnouncement>()
  const reduceMotion = useReducedMotion() ?? false

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
    onAddWorkout: () => {
      setOpenTask(null)
      setAddWorkoutOpen(true)
    },
  }
  const urgent = isUrgent(menace, completion.missing)
  const hasPlan = completion.missing.some((task) => entry.plans?.[task])
  const won = completion.missing.length === 0
  const minutesLeft = 24 * 60 - nowMin
  // Nothing left to plan once he's hunting: only to do.
  const canPlan = completion.missing.length > 0 && menace.level !== 'hunting'
  const notesTold = entry.mood !== undefined || (entry.notes ?? '').trim() !== ''

  // Under the ring, what matters next: the day won and its closing ritual, the time left, or the next plan.
  const below = won ? (
    <>
      <p className="font-rounded text-sm font-bold text-world-ink">Day {todayDayNumber} won</p>
      <button
        type="button"
        onClick={() => setOpenTask('notes')}
        className="flex min-h-touch items-center gap-1.5 rounded-full bg-surface px-4 font-rounded text-sm font-bold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        {notesTold ? notesStatusLine(entry) : 'How did it go?'}
      </button>
    </>
  ) : urgent ? (
    <p className="font-rounded text-sm font-bold text-danger-ink">{timeLeftLine(nowMin)}</p>
  ) : menace.next ? (
    <p className="font-rounded text-xs font-bold text-ink-muted">{planReminderLine(menace.next.task, menace.next.at)}</p>
  ) : null

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
          <Hero
            attemptLine={`${VARIANT_NAMES[rules.variant]} #${challenge.attemptNumber}`}
            dayNumber={todayDayNumber}
            completedCount={completedCount}
            celebrating={celebrating}
            streak={streak}
            jokersLeft={rules.jokers > 0 ? jokersLeft : undefined}
            below={below}
            menace={menace}
            missing={completion.missing}
            completion={completion.completion}
            announcement={announcement}
            name={profile?.name}
            started={hasStarted(completion.data)}
            yesterdayOpen={pendingLateDay != null}
            onLunge={() => setLunges((count) => count + 1)}
          />
          {pendingLateDay != null && <LateDayCard dayNumber={pendingLateDay} onOpen={onOpenLateDay} />}
          <LockBypassBanner />
          <BackupReminderBanner />

          <main className="px-4">
            {/* The buttons under the board slide with it as it closes up. */}
            <LayoutGroup>
              <DayBoard
                entry={entry}
                data={completion.data}
                completion={completion.completion}
                rules={rules}
                currentBook={currentBook}
                photo={photo?.blob}
                socialToday={socialToday}
                urgent={urgent}
                minutesLeft={urgent ? minutesLeft : undefined}
                covered={openTask !== null || addWorkoutOpen || planOpen || socialOpen}
                onAddWorkout={sheetContext.onAddWorkout}
                onOpen={setOpenTask}
              />
              <motion.div layout={reduceMotion ? false : 'position'} className="mt-4 flex flex-wrap gap-2">
                {canPlan && (
                  <button type="button" onClick={() => setPlanOpen(true)} className={ACTION_BUTTON}>
                    <span aria-hidden="true">🗓️</span>
                    {hasPlan ? 'Edit my plan' : 'Plan my evening'}
                  </button>
                )}
                {sheetContext.canPlanSocial && (
                  <button
                    type="button"
                    onClick={() => setSocialOpen(true)}
                    aria-label="Plan a social occasion"
                    className={ACTION_BUTTON}
                  >
                    <span aria-hidden="true">🥂</span>
                    Social night
                  </button>
                )}
                {/* Once the day is won, the hero's "How did it go?" opens the notes instead. */}
                {!won && (
                  <button type="button" onClick={() => setOpenTask('notes')} className={ACTION_BUTTON}>
                    <span aria-hidden="true">📝</span>
                    Notes
                  </button>
                )}
              </motion.div>
            </LayoutGroup>
          </main>
        </div>

        <TaskSheet content={openTask ? describeTask(openTask, sheetContext) : null} onClose={() => setOpenTask(null)} />
        <AddWorkoutSheet open={addWorkoutOpen} dayEntryId={entry.id} rules={rules} onClose={() => setAddWorkoutOpen(false)} />

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

type HeroProps = Omit<Parameters<typeof TodayHero>[0], 'duck' | 'speech' | 'taskCount'> &
  Parameters<typeof useDuck>[0]

/** The hero with its duck: rendered once the day has loaded, so the duck's hook always has its inputs. */
function Hero({ menace, missing, completion, dayNumber, announcement, name, started, yesterdayOpen, onLunge, ...hero }: HeroProps) {
  const { duck, speech } = useDuck({ menace, missing, completion, dayNumber, announcement, name, started, yesterdayOpen, onLunge })
  return <TodayHero {...hero} dayNumber={dayNumber} taskCount={TASK_IDS.length} duck={duck} speech={speech} />
}

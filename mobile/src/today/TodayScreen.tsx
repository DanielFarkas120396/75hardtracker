import type { ChallengeGate } from '@logic/challengeGate'
import { CHALLENGE_LENGTH } from '@logic/constants'
import { hasAnyProgress, TASK_IDS } from '@logic/dayCompletion'
import { addDaysISO, dateForDayNumber, formatDisplayDate, formatWeekday } from '@logic/dates'
import { daysUntilStart, isChallengeDay } from '@logic/days'
import { bedtimeMinutes, eveningDeadline, menace as resolveMenace, minutesToFinish, plansToMinutes, type Menace } from '@logic/menace'
import { LATE_GRACE_LINE, planReminderLine, planSavedLine, tasksLeftLine, timeLeftLine } from '@logic/microcopy'
import { challengeWeek, rulesFor } from '@logic/rulesets'
import { notesStatusLine } from '@logic/taskStatus'
import type { TaskId } from '@logic/types'
import { preStartPlanLine, VARIANT_NAMES } from '@logic/variantsCopy'
import { useState, type ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { GaugeRing } from '../components/GaugeRing'
import { Icon } from '../components/icons/Icon'
import { Mascot } from '../components/mascot/Mascot'
import { Button } from '../components/ui/Button'
import { Sheet } from '../components/ui/Sheet'
import type { Challenge, DayEntry } from '../db/types'
import { useAnnounceChanges } from '../hooks/useAnnounce'
import { useChallengeGate } from '../hooks/useChallengeGate'
import { useNowMinutes } from '../hooks/useNowMinutes'
import { useTheme } from '../theme/ThemeProvider'
import { DayBoard, LoggedToast, useLogged } from './DayBoard'
import { useDuck, type DuckAnnouncement } from './DuckHeader'
import { dayCompletion, useBedtime, useCurrentBook, useDayEntry, useProfile, useWorkoutsForEntry } from './hooks'
import { LateDayCard, LateDayView } from './LateDay'
import { MenaceAtmosphere } from './MenaceAtmosphere'
import { ActionButton, Centred, Page } from './parts'
import { PhotoCapture } from './PhotoCapture'
import { PlanForm } from './PlanSheet'
import { BookPicker } from './ReadingTask'
import { SocialForm } from './SocialOccasionSheet'
import { TaskSheet, type OpenSheet } from './TaskSheet'
import { TodayHero } from './TodayHero'
import { WeighInCard } from './WeighInCard'

/**
 * The Today tab: what the attempt's gate says to show. The web decides this in
 * App.tsx; the screens for an attempt that is no longer running (a missed day
 * beyond the jokers, a given-up or finished attempt) are part 4d, so a plain
 * screen says which it is, and Today is never blank. A joker used but not yet
 * announced doesn't hold Today back here: its announcement is part 4d too.
 */
export function Today() {
  const gate = useChallengeGate()
  if (!gate) return <Centred>Loading…</Centred>
  if (gate.kind === 'needsRestart') {
    return <NotRunning title={`Day ${gate.failedDayNumber} was missed`} line="This attempt is over. Starting again isn't built in this version yet." />
  }
  if (gate.kind === 'abandoned') return <NotRunning title="You gave up" line="Starting again isn't built in this version yet." />
  if (gate.kind === 'completed') return <NotRunning title={`${CHALLENGE_LENGTH} days done`} line="The victory screen isn't built in this version yet." />
  return <TodayScreen gate={gate} />
}

/**
 * Today for a running attempt: the countdown before Day 1, the day's tasks,
 * or yesterday's while it can still be finished (until noon) and the player
 * has opened it. The web's TodayScreen.
 */
export function TodayScreen({ gate }: { gate: ChallengeGate }) {
  const [lateOpen, setLateOpen] = useState(false)
  const late = gate.lateDayPending ? gate.lateDayNumber : null
  const hasToday = isChallengeDay(gate.todayDayNumber)
  // Finished, or past noon: the next unfinished yesterday starts closed again.
  if (late === null && lateOpen) setLateOpen(false)

  // The morning after Day 75 there's no today to show: only the last day to finish.
  if (late !== null && (lateOpen || !hasToday)) {
    return (
      <LateDayView
        key={late}
        challenge={gate.challenge}
        dayEntries={gate.dayEntries}
        dayNumber={late}
        date={addDaysISO(gate.today, -1)}
        onBack={hasToday ? () => setLateOpen(false) : undefined}
      />
    )
  }
  if (!hasToday) return <PreStartView challenge={gate.challenge} today={gate.today} todayDayNumber={gate.todayDayNumber} />
  // Keyed by day: the lunges, the sheets, the camera and the announcement all belong to one day.
  return <TodayTasks key={gate.todayDayNumber} gate={gate} pendingLateDay={late} onOpenLateDay={() => setLateOpen(true)} />
}

interface TodayTasksProps {
  gate: ChallengeGate
  /** Yesterday, while it can still be finished (until noon) and isn't yet. */
  pendingLateDay: number | null
  onOpenLateDay: () => void
}

function TodayTasks({ gate, pendingLateDay, onOpenLateDay }: TodayTasksProps) {
  const { challenge, dayEntries, today, todayDayNumber } = gate
  const rules = rulesFor(challenge)
  const entry = useDayEntry({ challengeId: challenge.id, dayNumber: todayDayNumber, date: today, dayEntries })
  const workouts = useWorkoutsForEntry(entry?.id)
  const nowMin = useNowMinutes()
  const bedtime = useBedtime()
  const profile = useProfile()
  const { currentBook } = useCurrentBook()
  const [sheet, setSheet] = useState<OpenSheet | null>(null)
  const [lunges, setLunges] = useState(0)
  const [announcement, setAnnouncement] = useState<DuckAnnouncement>()
  const { logged, log, clear } = useLogged()

  if (!entry || !workouts || bedtime === undefined) return <Centred>Loading…</Centred>

  const day = dayCompletion(entry, workouts, rules, challenge.socialDays)
  const menace = resolveMenace({
    data: day.data,
    nowMin,
    bedtimeMin: bedtimeMinutes(bedtime),
    plans: plansToMinutes(entry.plans),
    estimates: entry.planEstimates,
    rules,
  })
  const completedCount = TASK_IDS.filter((task) => day.completion[task]).length
  const socialToday = rules.socialDaysPerWeek > 0 && (challenge.socialDays?.includes(todayDayNumber) ?? false)
  const canPlanSocial = rules.socialDaysPerWeek > 0 && todayDayNumber < CHALLENGE_LENGTH
  const weekRestDay = dayEntries.find(
    (e) => e.restDay && e.dayNumber !== todayDayNumber && challengeWeek(e.dayNumber) === challengeWeek(todayDayNumber),
  )?.dayNumber
  const onAddWorkout = () => setSheet('add-workout')
  const announce = (text: string) => setAnnouncement((previous) => ({ text, reaction: 'relax', id: (previous?.id ?? 0) + 1 }))
  // Late in the evening with tasks left: the duck is tapping or hunting.
  const urgent = day.missing.length > 0 && (menace.level === 'tapping' || menace.level === 'hunting')
  const won = day.missing.length === 0
  const deadline = eveningDeadline(nowMin, bedtimeMinutes(bedtime))
  const hasPlan = day.missing.some((task) => entry.plans?.[task])
  // Nothing left to plan once he's hunting, only to do. The button keeps its place all evening: it is greyed out and says why.
  const tooLateToPlan = menace.level === 'hunting'

  // Under the gauge, what matters next: the day won and its closing ritual, the time left, or the next plan.
  // With none of these, the hero shows the duck's line there instead.
  const below = won ? (
    <Won dayNumber={todayDayNumber} entry={entry} onNotes={() => setSheet('notes')} />
  ) : urgent ? (
    <TimeLeft
      first={timeLeftLine(deadline, todayDayNumber)}
      second={
        deadline.until === 'bedtime'
          ? tasksLeftLine(day.missing.reduce((sum, task) => sum + minutesToFinish(task, day.data, rules), 0))
          : LATE_GRACE_LINE
      }
    />
  ) : menace.next ? (
    <Line>{planReminderLine(menace.next.task, menace.next.at)}</Line>
  ) : null

  return (
    <PhotoCapture entry={entry} onCameraOpen={() => setSheet(null)} onCameraUnavailable={() => setSheet('photo')}>
      <Page behind={<MenaceAtmosphere level={menace.level} flashes={lunges} />}>
        <Hero
          attemptLine={`${VARIANT_NAMES[rules.variant]} #${challenge.attemptNumber}`}
          dayNumber={todayDayNumber}
          completedCount={completedCount}
          streak={gate.streak}
          jokersLeft={rules.jokers > 0 ? gate.jokersLeft : undefined}
          why={profile?.why}
          below={below}
          menace={menace}
          missing={day.missing}
          completion={day.completion}
          announcement={announcement}
          name={profile?.name}
          started={hasAnyProgress(day.data)}
          yesterdayOpen={pendingLateDay !== null}
          onLunge={() => setLunges((count) => count + 1)}
        />
        {pendingLateDay !== null && <LateDayCard dayNumber={pendingLateDay} onOpen={onOpenLateDay} />}
        <WeighInCard today={today} dayNumber={todayDayNumber} />

        <View style={styles.main}>
          <DayBoard
            entry={entry}
            data={day.data}
            completion={day.completion}
            rules={rules}
            currentBook={currentBook}
            socialToday={socialToday}
            urgent={urgent}
            minutesLeft={urgent ? deadline.minutesLeft : undefined}
            onLogged={log}
            onAddWorkout={onAddWorkout}
            onOpen={setSheet}
          />
          <View style={styles.actions}>
            {!won && (
              <ActionButton
                icon="calendar"
                label={tooLateToPlan ? 'Too late to plan' : hasPlan ? 'Edit my plan' : 'Plan my evening'}
                disabled={tooLateToPlan}
                onPress={() => setSheet('plan')}
              />
            )}
            {canPlanSocial && <ActionButton icon="drink" label="Social night" accessibilityLabel="Plan a social night" onPress={() => setSheet('social')} />}
            {/* Once the day is won, the hero's "How did it go?" opens the notes instead. */}
            {!won && <ActionButton icon="notes" label="Notes" onPress={() => setSheet('notes')} />}
          </View>
        </View>
      </Page>

      <LoggedToast logged={logged} onDone={clear} />
      <TaskSheet
        sheet={sheet}
        context={{
          entry,
          workouts,
          completion: day.completion,
          rules,
          dayNumber: todayDayNumber,
          socialToday,
          weekRestDay,
          libraryOnly: false,
          onAddWorkout,
          onPlanSocial: canPlanSocial ? () => setSheet('social') : undefined,
        }}
        plan={
          <PlanForm
            entry={entry}
            data={day.data}
            missing={day.missing}
            nowMin={nowMin}
            rules={rules}
            onClose={() => setSheet(null)}
            onSaved={(earliest) => {
              setSheet(null)
              if (earliest !== null) announce(planSavedLine(earliest))
            }}
          />
        }
        social={
          <SocialForm
            challenge={challenge}
            today={today}
            todayDayNumber={todayDayNumber}
            onClose={() => setSheet(null)}
            onDeclared={(dayNumber) => announce(`${formatWeekday(dateForDayNumber(challenge.startDate, dayNumber))}. One drink. I'm counting.`)}
          />
        }
        onClose={() => setSheet(null)}
      />
    </PhotoCapture>
  )
}

interface HeroProps {
  attemptLine: string
  dayNumber: number
  completedCount: number
  streak: number
  jokersLeft: number | undefined
  why?: string
  /** What matters next under the gauge, or null: the duck's line then stays there. */
  below: ReactNode
  menace: Menace
  missing: readonly TaskId[]
  completion: Record<TaskId, boolean>
  announcement?: DuckAnnouncement
  name?: string
  started: boolean
  yesterdayOpen: boolean
  onLunge: () => void
}

/**
 * The hero with its duck: rendered once the day has loaded, so the duck's hook always has its inputs. When nothing
 * else is under the gauge, his line stays there (said aloud as it changes) and his bubble keeps to reactions and chatter.
 */
function Hero({ menace, missing, completion, dayNumber, announcement, name, started, yesterdayOpen, onLunge, below, ...hero }: HeroProps) {
  const lineInHero = below === null
  const { duck, speech, line } = useDuck({ menace, missing, completion, dayNumber, announcement, name, started, yesterdayOpen, onLunge, lineInHero })
  return <TodayHero {...hero} dayNumber={dayNumber} duck={duck} speech={speech} below={lineInHero ? <Line announced>{line}</Line> : below} />
}

/** "Day N won", and the day's closing ritual: how it went. */
function Won({ dayNumber, entry, onNotes }: { dayNumber: number; entry: DayEntry; onNotes: () => void }) {
  const { colors, fonts } = useTheme()
  const told = entry.mood !== undefined || (entry.notes ?? '').trim() !== ''
  const label = told ? notesStatusLine(entry) : 'How did it go?'
  return (
    <>
      <Text style={[styles.won, { color: colors.worldInk, fontFamily: fonts.rounded.bold }]}>Day {dayNumber} won</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onNotes} style={[styles.pill, { backgroundColor: colors.surface }]}>
        <Text style={[styles.won, { color: colors.ink, fontFamily: fonts.rounded.bold }]}>{label}</Text>
      </Pressable>
    </>
  )
}

/** The evening's clock under the gauge, and what the tasks left still take. */
function TimeLeft({ first, second }: { first: string; second: string }) {
  const { colors, fonts } = useTheme()
  useAnnounceChanges(first)
  return (
    <View style={styles.timeLeft}>
      <Text style={[styles.won, { color: colors.dangerInk, fontFamily: fonts.rounded.bold }]}>{first}</Text>
      <Text style={[styles.small, { color: colors.inkMuted, fontFamily: fonts.rounded.semibold }]}>{second}</Text>
    </View>
  )
}

/** A line under the gauge: the next plan, or the duck's own line, which is said aloud when it changes. */
function Line({ children, announced = false }: { children: string; announced?: boolean }) {
  const { colors, fonts } = useTheme()
  useAnnounceChanges(announced ? children : '')
  return <Text style={[styles.small, styles.line, { color: colors.inkMuted, fontFamily: fonts.rounded.bold }]}>{children}</Text>
}

/** An attempt that is no longer running, said plainly. Its real screens are part 4d. */
function NotRunning({ title, line }: { title: string; line: string }) {
  const { colors, fonts } = useTheme()
  return (
    <View style={[styles.screen, styles.centred, { backgroundColor: colors.canvas }]}>
      <Mascot mood="judging" size={96} />
      <Text accessibilityRole="header" style={[styles.heading, { color: colors.ink, fontFamily: fonts.display.semibold }]}>
        {title}
      </Text>
      <Text style={[styles.body, styles.narrow, { color: colors.inkMuted, fontFamily: fonts.rounded.regular }]}>{line}</Text>
    </View>
  )
}

/**
 * What Today shows before Day 1: a countdown instead of task tiles (no day can
 * be logged yet), in the Today hero's look (the gauge at 0), so Day 1 isn't a
 * jump. The web's PreStartView.
 */
export function PreStartView({ challenge, today, todayDayNumber }: { challenge: Challenge; today: string; todayDayNumber: number }) {
  const { colors, fonts } = useTheme()
  const insets = useSafeAreaInsets()
  const profile = useProfile()
  const [socialOpen, setSocialOpen] = useState(false)
  const brokenStartDate = !Number.isFinite(todayDayNumber)
  const days = daysUntilStart(todayDayNumber)
  const rules = rulesFor(challenge)
  const muted = { color: colors.inkMuted, fontFamily: fonts.rounded.regular }

  return (
    <>
      <ScrollView
        style={{ backgroundColor: colors.canvas }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.preStart, { paddingTop: insets.top + 24 }]}
      >
        {profile && <Text style={[styles.won, { color: colors.ink, fontFamily: fonts.rounded.bold }]}>Hey {profile.name}</Text>}
        <View style={[styles.card, { backgroundColor: colors.worldSoft }]}>
          <Text style={[styles.small, { color: colors.inkMuted, fontFamily: fonts.rounded.bold }]}>
            {VARIANT_NAMES[rules.variant]} #{challenge.attemptNumber}
          </Text>
          <View style={styles.duckAndGauge}>
            <Mascot mood="waiting" size={64} />
            <View style={styles.smallGauge}>
              <GaugeRing value={0} max={TASK_IDS.length} />
            </View>
          </View>
          {profile && (
            <Text numberOfLines={2} style={[styles.won, styles.quote, { color: colors.inkMuted, fontFamily: fonts.quote }]}>
              “{profile.why}”
            </Text>
          )}
        </View>
        {brokenStartDate ? (
          <>
            <Text accessibilityRole="header" style={[styles.heading, { color: colors.ink, fontFamily: fonts.display.semibold }]}>
              Pick a start date
            </Text>
            <Text style={[styles.body, styles.narrow, muted]}>Your challenge doesn&apos;t have a valid start date. Set one in Settings to begin.</Text>
          </>
        ) : (
          <>
            <Text accessibilityRole="header" style={[styles.heading, { color: colors.ink, fontFamily: fonts.display.semibold }]}>
              {days === 1 ? 'Day 1 starts tomorrow' : `Day 1 starts in ${days} days`}
            </Text>
            <Text style={[styles.body, styles.narrow, muted]}>
              Your {CHALLENGE_LENGTH} days begin on {formatDisplayDate(challenge.startDate)}. Use the time to pick your book, {preStartPlanLine(rules)} and
              stock up on water.
            </Text>
            <Text style={[styles.won, styles.narrow, muted]}>You can still move the start date in Settings.</Text>
            <View accessibilityLabel="Your book" style={[styles.book, { backgroundColor: colors.surface }]}>
              <BookPicker />
            </View>
            {rules.socialDaysPerWeek > 0 && (
              <Button
                label="Plan a social night"
                variant="secondary"
                onPress={() => setSocialOpen(true)}
                icon={<Icon name="drink" size={18} color={colors.worldInk} />}
              />
            )}
          </>
        )}
      </ScrollView>
      <Sheet open={socialOpen} onClose={() => setSocialOpen(false)} label="Plan a social night">
        <SocialForm challenge={challenge} today={today} todayDayNumber={todayDayNumber} onClose={() => setSocialOpen(false)} onDeclared={() => undefined} />
      </Sheet>
    </>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centred: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  main: { paddingHorizontal: 16 },
  actions: { marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  won: { fontSize: 14 },
  small: { fontSize: 12 },
  body: { fontSize: 16, lineHeight: 23 },
  narrow: { maxWidth: 320, textAlign: 'center' },
  heading: { fontSize: 24, letterSpacing: 0.6, textAlign: 'center' },
  pill: { minHeight: 48, justifyContent: 'center', borderRadius: 24, paddingHorizontal: 16 },
  timeLeft: { alignItems: 'center' },
  line: { maxWidth: 176, textAlign: 'center' },
  preStart: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 24, paddingBottom: 120 },
  card: { width: '100%', maxWidth: 320, alignItems: 'center', gap: 12, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 16 },
  duckAndGauge: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  smallGauge: { width: 160 },
  quote: { maxWidth: 320, textAlign: 'center' },
  book: { width: '100%', maxWidth: 320, borderRadius: 20, padding: 12 },
})

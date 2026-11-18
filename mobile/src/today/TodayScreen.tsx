import type { ChallengeGate } from '@logic/challengeGate'
import { CHALLENGE_LENGTH } from '@logic/constants'
import { hasAnyProgress, TASK_IDS } from '@logic/dayCompletion'
import { formatDisplayDate } from '@logic/dates'
import { daysUntilStart, isChallengeDay } from '@logic/days'
import { bedtimeMinutes, eveningDeadline, menace as resolveMenace, minutesToFinish, plansToMinutes } from '@logic/menace'
import { duckLine, LATE_GRACE_LINE, planReminderLine, tasksLeftLine, timeLeftLine } from '@logic/microcopy'
import { challengeWeek, rulesFor } from '@logic/rulesets'
import { notesStatusLine } from '@logic/taskStatus'
import { preStartPlanLine, VARIANT_NAMES } from '@logic/variantsCopy'
import { useState, type ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { GaugeRing } from '../components/GaugeRing'
import { Icon } from '../components/icons/Icon'
import { Mascot } from '../components/mascot/Mascot'
import type { Challenge, DayEntry } from '../db/types'
import { useAnnounceChanges } from '../hooks/useAnnounce'
import { useChallengeGate } from '../hooks/useChallengeGate'
import { useNowMinutes } from '../hooks/useNowMinutes'
import { useTheme } from '../theme/ThemeProvider'
import { withAlpha } from '../theme/tokens'
import { CAMERA_SHEET_SHARE } from './CameraSheet'
import { DayBoard, LoggedToast, useLogged } from './DayBoard'
import { dayCompletion, useBedtime, useCurrentBook, useDayEntry, useProfile, useWorkoutsForEntry } from './hooks'
import { PhotoCapture } from './PhotoCapture'
import { usePhotoCapture } from './photoCaptureContext'
import { BookPicker } from './ReadingTask'
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

/** Today for a running attempt: the countdown before Day 1, then the day's tasks. The web's TodayScreen. */
export function TodayScreen({ gate }: { gate: ChallengeGate }) {
  if (!isChallengeDay(gate.todayDayNumber)) {
    return <PreStartView challenge={gate.challenge} todayDayNumber={gate.todayDayNumber} />
  }
  // Keyed by day: the sheets and the camera all belong to one day.
  return <TodayTasks key={gate.todayDayNumber} gate={gate} />
}

function TodayTasks({ gate }: { gate: ChallengeGate }) {
  const { challenge, dayEntries, today, todayDayNumber } = gate
  const rules = rulesFor(challenge)
  const entry = useDayEntry({ challengeId: challenge.id, dayNumber: todayDayNumber, date: today, dayEntries })
  const workouts = useWorkoutsForEntry(entry?.id)
  const nowMin = useNowMinutes()
  const bedtime = useBedtime()
  const profile = useProfile()
  const { currentBook } = useCurrentBook()
  const [sheet, setSheet] = useState<OpenSheet | null>(null)
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
  const weekRestDay = dayEntries.find(
    (e) => e.restDay && e.dayNumber !== todayDayNumber && challengeWeek(e.dayNumber) === challengeWeek(todayDayNumber),
  )?.dayNumber
  const onAddWorkout = () => setSheet('add-workout')
  // Late in the evening with tasks left: the duck is tapping or hunting.
  const urgent = day.missing.length > 0 && (menace.level === 'tapping' || menace.level === 'hunting')
  const won = day.missing.length === 0
  const deadline = eveningDeadline(nowMin, bedtimeMinutes(bedtime))
  const line = duckLine({ menace, missing: day.missing, dayNumber: todayDayNumber, name: profile?.name, started: hasAnyProgress(day.data) })

  return (
    <PhotoCapture entry={entry} onCameraOpen={() => setSheet(null)} onCameraUnavailable={() => setSheet('photo')}>
      <Page>
        <TodayHero
          attemptLine={`${VARIANT_NAMES[rules.variant]} #${challenge.attemptNumber}`}
          dayNumber={todayDayNumber}
          completedCount={completedCount}
          streak={gate.streak}
          jokersLeft={rules.jokers > 0 ? gate.jokersLeft : undefined}
          level={menace.level}
          completion={day.completion}
          why={profile?.why}
          below={
            won ? (
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
              <DuckLine>{planReminderLine(menace.next.task, menace.next.at)}</DuckLine>
            ) : (
              <DuckLine announced>{line}</DuckLine>
            )
          }
        />
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
          {/* Once the day is won, the hero's "How did it go?" opens the notes instead. "Plan my evening" and "Social night" join this row in part 4b. */}
          {!won && <ActionButton icon="notes" label="Notes" onPress={() => setSheet('notes')} />}
        </View>
      </Page>

      <LoggedToast logged={logged} onDone={clear} />
      <TaskSheet
        sheet={sheet}
        context={{ entry, workouts, completion: day.completion, rules, dayNumber: todayDayNumber, socialToday, weekRestDay, libraryOnly: false, onAddWorkout }}
        onClose={() => setSheet(null)}
      />
    </PhotoCapture>
  )
}

/** The scrolling page under the status bar. While the camera is open it gains room at the bottom, so everything can still be scrolled up above the sheet. */
function Page({ children }: { children: ReactNode }) {
  const { colors } = useTheme()
  const { height } = useWindowDimensions()
  const { cameraOpen } = usePhotoCapture()
  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.canvas }]}>
      <ScrollView
        testID="today-scroll"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 96 + (cameraOpen ? height * CAMERA_SHEET_SHARE : 0) }}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  )
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

/** The duck's line under the gauge. His own line is said aloud when it changes. */
function DuckLine({ children, announced = false }: { children: string; announced?: boolean }) {
  const { colors, fonts } = useTheme()
  useAnnounceChanges(announced ? children : '')
  return <Text style={[styles.small, styles.duckLine, { color: colors.inkMuted, fontFamily: fonts.rounded.bold }]}>{children}</Text>
}

/** A labelled button under the board, in thumb reach. */
function ActionButton({ icon, label, onPress }: { icon: 'notes'; label: string; onPress: () => void }) {
  const { colors, fonts, mode } = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.action, { backgroundColor: colors.surface, borderColor: mode === 'light' ? withAlpha(colors.ink, 0.1) : 'transparent' }]}
    >
      <Icon name={icon} size={18} color={colors.worldInk} />
      <Text style={[styles.won, { color: colors.ink, fontFamily: fonts.rounded.bold }]}>{label}</Text>
    </Pressable>
  )
}

function Centred({ children }: { children: string }) {
  const { colors, fonts } = useTheme()
  return (
    <View style={[styles.screen, styles.centred, { backgroundColor: colors.canvas }]}>
      <Text style={[styles.body, { color: colors.inkMuted, fontFamily: fonts.rounded.regular }]}>{children}</Text>
    </View>
  )
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
 * jump. The web's PreStartView; planning a social night from here comes with part 4b.
 */
export function PreStartView({ challenge, todayDayNumber }: { challenge: Challenge; todayDayNumber: number }) {
  const { colors, fonts } = useTheme()
  const insets = useSafeAreaInsets()
  const profile = useProfile()
  const brokenStartDate = !Number.isFinite(todayDayNumber)
  const days = daysUntilStart(todayDayNumber)
  const rules = rulesFor(challenge)
  const muted = { color: colors.inkMuted, fontFamily: fonts.rounded.regular }

  return (
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
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centred: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  main: { paddingHorizontal: 16 },
  won: { fontSize: 14 },
  small: { fontSize: 12 },
  body: { fontSize: 16, lineHeight: 23 },
  narrow: { maxWidth: 320, textAlign: 'center' },
  heading: { fontSize: 24, letterSpacing: 0.6, textAlign: 'center' },
  pill: { minHeight: 48, justifyContent: 'center', borderRadius: 24, paddingHorizontal: 16 },
  timeLeft: { alignItems: 'center' },
  duckLine: { maxWidth: 176, textAlign: 'center' },
  action: { marginTop: 16, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 24, borderWidth: 1, paddingHorizontal: 12 },
  preStart: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 24, paddingBottom: 120 },
  card: { width: '100%', maxWidth: 320, alignItems: 'center', gap: 12, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 16 },
  duckAndGauge: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  smallGauge: { width: 160 },
  quote: { maxWidth: 320, textAlign: 'center' },
  book: { width: '100%', maxWidth: 320, borderRadius: 20, padding: 12 },
})

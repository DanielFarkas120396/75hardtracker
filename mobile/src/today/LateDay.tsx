import { challengeWeek, rulesFor } from '@logic/rulesets'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Icon } from '../components/icons/Icon'
import type { Challenge, DayEntry } from '../db/types'
import { useTheme } from '../theme/ThemeProvider'
import { DayBoard, LoggedToast, useLogged } from './DayBoard'
import { dayCompletion, useCurrentBook, useDayEntry, useWorkoutsForEntry } from './hooks'
import { ActionButton, Centred, Page } from './parts'
import { PhotoCapture } from './PhotoCapture'
import { TaskSheet, type OpenSheet } from './TaskSheet'

/** On Today, under the hero: yesterday isn't finished, and there's until noon to log it. The web's LateDayCard. */
export function LateDayCard({ dayNumber, onOpen }: { dayNumber: number; onOpen: () => void }) {
  const { colors, fonts } = useTheme()
  return (
    <View style={[styles.card, { borderColor: colors.dangerInk, backgroundColor: colors.surface }]}>
      <View style={[styles.well, { backgroundColor: colors.worldSoft }]}>
        <Icon name="history" color={colors.worldInk} />
      </View>
      <View style={styles.words}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.ink, fontFamily: fonts.rounded.bold }]}>
          Day {dayNumber} isn&apos;t finished
        </Text>
        <Text style={[styles.small, { color: colors.inkMuted, fontFamily: fonts.rounded.regular }]}>Forgot to log it? You have until 12:00.</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Finish it"
        onPress={onOpen}
        style={({ pressed }) => [styles.finish, { backgroundColor: colors.world }, pressed && styles.pressed]}
      >
        <Text style={[styles.small, { color: colors.onWorld, fontFamily: fonts.rounded.semibold }]}>Finish it</Text>
      </Pressable>
    </View>
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
 * Today, without the duck or the plan, and a photo only from the library (the
 * camera would take today's). The web's LateDayView.
 */
export function LateDayView({ challenge, dayEntries, dayNumber, date, onBack }: LateDayViewProps) {
  const { colors, fonts } = useTheme()
  const rules = rulesFor(challenge)
  const entry = useDayEntry({ challengeId: challenge.id, dayNumber, date, dayEntries })
  const workouts = useWorkoutsForEntry(entry?.id)
  const { currentBook } = useCurrentBook()
  const [sheet, setSheet] = useState<OpenSheet | null>(null)
  const { logged, log, clear } = useLogged()

  if (!entry || !workouts) return <Centred>Loading…</Centred>

  const day = dayCompletion(entry, workouts, rules, challenge.socialDays)
  const socialThatDay = rules.socialDaysPerWeek > 0 && (challenge.socialDays?.includes(dayNumber) ?? false)
  const weekRestDay = dayEntries.find(
    (e) => e.restDay && e.dayNumber !== dayNumber && challengeWeek(e.dayNumber) === challengeWeek(dayNumber),
  )?.dayNumber
  const onAddWorkout = () => setSheet('add-workout')

  return (
    <PhotoCapture entry={entry} libraryOnly onCameraOpen={() => setSheet(null)}>
      <Page>
        <View style={styles.header}>
          {onBack && (
            <Pressable accessibilityRole="button" accessibilityLabel="Today" onPress={onBack} style={styles.back}>
              <View style={styles.flipped}>
                <Icon name="chevron" size={18} color={colors.worldInk} />
              </View>
              <Text style={[styles.title, { color: colors.worldInk, fontFamily: fonts.rounded.bold }]}>Today</Text>
            </Pressable>
          )}
          <Text style={[styles.small, !onBack && styles.alone, { color: colors.inkMuted, fontFamily: fonts.rounded.bold }]}>Yesterday</Text>
          <Text accessibilityRole="header" style={[styles.heading, { color: colors.worldInk, fontFamily: fonts.display.semibold }]}>
            Finish Day {dayNumber}
          </Text>
          <Text style={[styles.small, styles.lead, { color: colors.inkMuted, fontFamily: fonts.rounded.regular }]}>
            Log what you did yesterday. You have until 12:00; after that, the day counts as missed.
          </Text>
        </View>

        <View style={styles.main}>
          <DayBoard
            entry={entry}
            data={day.data}
            completion={day.completion}
            rules={rules}
            currentBook={currentBook}
            socialToday={socialThatDay}
            onLogged={log}
            onAddWorkout={onAddWorkout}
            onOpen={setSheet}
          />
          <View style={styles.actions}>
            <ActionButton icon="notes" label="Notes" onPress={() => setSheet('notes')} />
          </View>
        </View>
      </Page>

      <LoggedToast logged={logged} onDone={clear} />
      <TaskSheet
        sheet={sheet}
        context={{ entry, workouts, completion: day.completion, rules, dayNumber, socialToday: socialThatDay, weekRestDay, libraryOnly: true, onAddWorkout }}
        onClose={() => setSheet(null)}
      />
    </PhotoCapture>
  )
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, borderWidth: 2, padding: 16 },
  well: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  words: { flex: 1, minWidth: 0 },
  title: { fontSize: 16 },
  small: { fontSize: 14 },
  finish: { minHeight: 48, justifyContent: 'center', borderRadius: 24, paddingHorizontal: 16 },
  pressed: { transform: [{ scale: 0.95 }] },
  header: { padding: 16 },
  back: { minHeight: 48, marginLeft: -8, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 12, paddingHorizontal: 8 },
  flipped: { transform: [{ rotate: '180deg' }] },
  alone: { paddingTop: 8 },
  heading: { fontSize: 30, letterSpacing: 0.75 },
  lead: { marginTop: 4, lineHeight: 20 },
  main: { paddingHorizontal: 16 },
  actions: { marginTop: 16, flexDirection: 'row' },
})

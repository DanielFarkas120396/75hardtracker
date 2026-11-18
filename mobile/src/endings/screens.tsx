import { givenUpDay } from '@logic/attempts'
import { missingTasks, TASK_IDS } from '@logic/dayCompletion'
import { toDayTaskData } from '@logic/mappers'
import { SAVE_FAILED_LINE, taskRule } from '@logic/microcopy'
import { rulesFor, variantOf, type Ruleset } from '@logic/rulesets'
import type { TaskId } from '@logic/types'
import { missedDayExplanation, VARIANT_NAMES } from '@logic/variantsCopy'
import { useEffect, useState, type ReactNode } from 'react'
import { AccessibilityInfo, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Mascot } from '../components/mascot/Mascot'
import { Button } from '../components/ui/Button'
import { Sheet } from '../components/ui/Sheet'
import { challengeRepo } from '../db/repositories/challengeRepo'
import { dayEntryRepo } from '../db/repositories/dayEntryRepo'
import { workoutRepo } from '../db/repositories/workoutRepo'
import type { Challenge } from '../db/types'
import { useLiveQuery } from '../db/useLiveQuery'
import { useHideTabBar } from '../hooks/useTabBar'
import { Alert } from '../onboarding/parts'
import { useTheme } from '../theme/ThemeProvider'
import { withAlpha } from '../theme/tokens'
import { useProfile } from '../today/hooks'
import { NewChallengeForm } from './NewChallenge'

// The screens that take Today's place when an attempt has turned: a missed day, a joker spent, an attempt given up.
// The web's src/screens/RestartFlow/. They hide the tab bar: on the web they replace the whole app.

/** The screen's frame: everything centred on the canvas, scrolling when it doesn't fit. */
function GateScreen({ children }: { children: ReactNode }) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  useHideTabBar()
  return (
    <ScrollView
      style={{ backgroundColor: colors.canvas }}
      contentContainerStyle={[styles.screen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  )
}

/**
 * The title of a screen that replaces Today. What the player was on has gone with the old screen, so the title is
 * said as it appears, telling VoiceOver where they are.
 */
export function GateHeading({ children, size = 'md' }: { children: string; size?: 'md' | 'lg' }) {
  const { colors, fonts } = useTheme()
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(children)
  }, [children])
  return (
    <Text accessibilityRole="header" style={[size === 'lg' ? styles.headingLarge : styles.heading, { color: colors.ink, fontFamily: fonts.display.semibold }]}>
      {children}
    </Text>
  )
}

/** "You said: “…”": the reason, quoted back at a hard moment. Nothing without a profile. */
export function YouSaid({ centred = true }: { centred?: boolean }) {
  const { colors, fonts } = useTheme()
  const profile = useProfile()
  if (!profile) return null
  return <Text style={[styles.small, centred && styles.narrow, { color: colors.inkMuted, fontFamily: fonts.quote }]}>You said: “{profile.why}”</Text>
}

function Muted({ children, spaced = false }: { children: ReactNode; spaced?: boolean }) {
  const { colors, fonts } = useTheme()
  return <Text style={[styles.body, styles.narrow, spaced && styles.spaced, { color: colors.inkMuted, fontFamily: fonts.rounded.regular }]}>{children}</Text>
}

/** The duck's last word on the screen. */
function DuckLine({ children }: { children: ReactNode }) {
  const { colors, fonts } = useTheme()
  return <Text style={[styles.body, styles.narrow, styles.spaced, { color: colors.ink, fontFamily: fonts.rounded.bold }]}>{children}</Text>
}

/** What a given day was missing, as a list of rule lines. */
export function MissedTasksList({ challenge, dayNumber }: { challenge: Challenge; dayNumber: number }) {
  const { colors, fonts } = useTheme()
  const result = useLiveQuery(async (): Promise<{ rules: Ruleset; missing: TaskId[] }> => {
    // Re-read the row instead of trusting the prop, which can go stale.
    const current = (await challengeRepo.getById(challenge.id)) ?? challenge
    const rules = rulesFor(current)
    const entry = await dayEntryRepo.getByChallengeAndDayNumber(challenge.id, dayNumber)
    if (!entry) return { rules, missing: [...TASK_IDS] }
    return { rules, missing: missingTasks(toDayTaskData(entry, await workoutRepo.getForDayEntry(entry.id), current.socialDays), rules) }
  }, [challenge.id, dayNumber])

  if (!result || result.missing.length === 0) return null
  return (
    <View accessibilityRole="list" style={styles.missed}>
      {result.missing.map((task) => (
        <Text key={task} style={[styles.missedLine, { backgroundColor: withAlpha(colors.danger, 0.1), color: colors.dangerInk, fontFamily: fonts.rounded.bold }]}>
          ✕ {taskRule(task, result.rules)}
        </Text>
      ))}
    </View>
  )
}

interface DayFailedScreenProps {
  challenge: Challenge
  failedDayNumber: number
  today: string
}

/** After a missed day beyond the jokers: shows what was missed, then restarts from Day 1 on confirmation. */
export function DayFailedScreen({ challenge, failedDayNumber, today }: DayFailedScreenProps) {
  const [restarting, setRestarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const profile = useProfile()

  const confirmRestart = async () => {
    setRestarting(true)
    setError(null)
    try {
      await challengeRepo.restart(challenge.id, today)
    } catch {
      setRestarting(false)
      setError(SAVE_FAILED_LINE)
    }
  }

  return (
    <GateScreen>
      <Mascot mood="judging" />
      <GateHeading>{`Day ${failedDayNumber} wasn't completed`}</GateHeading>
      <Muted>{missedDayExplanation(rulesFor(challenge), challenge.attemptNumber)}</Muted>
      <MissedTasksList challenge={challenge} dayNumber={failedDayNumber} />
      {/* After the missed list, as on the joker screen. */}
      <YouSaid />
      <DuckLine>{profile ? `Again, ${profile.name}. From Day 1. I'm watching.` : "Again. From Day 1. I'm watching."}</DuckLine>
      {error !== null && <Alert>{error}</Alert>}
      <Button label={restarting ? 'Restarting…' : 'Restart from Day 1'} disabled={restarting} onPress={() => void confirmRestart()} style={styles.button} />
    </GateScreen>
  )
}

interface JokerUsedScreenProps {
  challenge: Challenge
  /** Missed days not yet announced: a subset of the attempt's full missed-day list. */
  newlyMissed: number[]
  /** Every missed day so far, announced or not: what gets acknowledged on "Keep going". */
  missedCount: number
  jokersLeft: number
}

/** "12 and 13", or "3, 4 and 5". */
function formatDayList(days: readonly number[]): string {
  if (days.length < 2) return days.join('')
  if (days.length === 2) return `${days[0]} and ${days[1]}`
  return `${days.slice(0, -1).join(', ')} and ${days[days.length - 1]}`
}

/** Announces a joker spent on one or more missed days, then acknowledges them so it isn't shown again. */
export function JokerUsedScreen({ challenge, newlyMissed, missedCount, jokersLeft }: JokerUsedScreenProps) {
  const { colors, fonts } = useTheme()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const keepGoing = async () => {
    setSaving(true)
    setError(null)
    try {
      await challengeRepo.acknowledgeJokers(challenge.id, missedCount)
    } catch {
      setSaving(false)
      setError(SAVE_FAILED_LINE)
    }
  }

  const heading = newlyMissed.length === 1 ? `Day ${newlyMissed[0]} wasn't completed` : `Days ${formatDayList(newlyMissed)} weren't completed`
  const jokerLine = newlyMissed.length === 1 ? `Joker used. ${jokersLeft} left.` : `${newlyMissed.length} jokers used. ${jokersLeft} left.`
  const duckLine = jokersLeft === 0 ? "That was your last joker. Next time, it's Day 1." : "I'll let that one go. Once."

  return (
    <GateScreen>
      <Mascot mood="judging" />
      <GateHeading>{heading}</GateHeading>
      {newlyMissed.map((dayNumber) => (
        <View key={dayNumber} style={styles.day}>
          {newlyMissed.length > 1 && <Text style={[styles.dayLabel, { color: colors.inkMuted, fontFamily: fonts.rounded.bold }]}>Day {dayNumber}</Text>}
          <MissedTasksList challenge={challenge} dayNumber={dayNumber} />
        </View>
      ))}
      <Muted spaced>{jokerLine}</Muted>
      <Muted>Your streak starts over. Your challenge doesn&apos;t.</Muted>
      <YouSaid />
      <DuckLine>{duckLine}</DuckLine>
      {error !== null && <Alert>{error}</Alert>}
      <Button label={saving ? 'Keeping going…' : 'Keep going'} disabled={saving} onPress={() => void keepGoing()} style={styles.button} />
    </GateScreen>
  )
}

/** Shown once the attempt was given up (Settings), until the next one starts. */
export function GaveUpScreen({ challenge, today }: { challenge: Challenge; today: string }) {
  const { colors, fonts } = useTheme()
  const [sheetOpen, setSheetOpen] = useState(false)
  const day = givenUpDay(challenge.startDate, challenge.abandonedOn)
  const variant = variantOf(challenge)
  const profile = useProfile()

  return (
    <>
      <GateScreen>
        <Mascot mood="judging" />
        <GateHeading>{day === undefined ? 'You gave up' : `You gave up on Day ${day}`}</GateHeading>
        <Muted>
          {VARIANT_NAMES[variant]}, attempt #{challenge.attemptNumber}. It stays in your history.
        </Muted>
        <DuckLine>{profile ? `Fine, ${profile.name}. Pick something. I'm still watching.` : "Fine. Pick something. I'm still watching."}</DuckLine>
        <Button label="Start a new challenge" onPress={() => setSheetOpen(true)} style={styles.button} />
        <Text style={[styles.hint, styles.narrow, { color: colors.inkMuted, fontFamily: fonts.rounded.regular }]}>Pick your next challenge and when it starts.</Text>
      </GateScreen>
      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} label="Start a new challenge">
        <NewChallengeForm defaultVariant={variant} today={today} onClose={() => setSheetOpen(false)} />
      </Sheet>
    </>
  )
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 24 },
  heading: { fontSize: 24, letterSpacing: 0.6, textAlign: 'center' },
  headingLarge: { fontSize: 36, lineHeight: 38, letterSpacing: 0.9, textAlign: 'center', textTransform: 'uppercase' },
  body: { fontSize: 16, lineHeight: 23 },
  small: { fontSize: 14, lineHeight: 20 },
  hint: { fontSize: 12 },
  narrow: { maxWidth: 320, textAlign: 'center' },
  spaced: { marginTop: 8 },
  button: { marginTop: 8 },
  missed: { marginTop: 8, width: '100%', maxWidth: 320, gap: 8 },
  missedLine: { overflow: 'hidden', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8, fontSize: 14, lineHeight: 20 },
  day: { width: '100%', maxWidth: 320 },
  dayLabel: { fontSize: 12, letterSpacing: 0.3, textAlign: 'center', textTransform: 'uppercase' },
})

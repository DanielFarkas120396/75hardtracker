import { dateForDayNumber, formatDisplayDate } from '@logic/dates'
import { formatMinutes } from '@logic/duration'
import { CHALLENGE_LENGTH } from '@logic/constants'
import { defaultStartChoice } from '@logic/onboardingCopy'
import { rulesFor, variantOf, type ChallengeVariant } from '@logic/rulesets'
import { victoryLine, victoryTitle } from '@logic/variantsCopy'
import { useEffect, useEffectEvent, useState } from 'react'
import { Animated, Easing, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Mascot } from '../components/mascot/Mascot'
import { Button } from '../components/ui/Button'
import { Sheet } from '../components/ui/Sheet'
import { challengeRepo } from '../db/repositories/challengeRepo'
import type { Challenge } from '../db/types'
import { useNowMinutes } from '../hooks/useNowMinutes'
import { useReduceMotion } from '../hooks/useReduceMotion'
import { useChime } from '../hooks/useSound'
import { Alert } from '../onboarding/parts'
import { StartDateChoice, useStartChoice } from '../onboarding/StartDateChoice'
import { VariantPicker } from '../onboarding/VariantPicker'
import { useTheme } from '../theme/ThemeProvider'
import { canAnimate } from '../today/boardSettle'
import { useChallengeStats } from './stats'

interface NewChallengeFormProps {
  defaultVariant: ChallengeVariant
  today: string
  onClose: () => void
}

/**
 * "Start a new challenge": pick the next attempt's challenge, and when it begins. Shown in a Sheet, which mounts it
 * afresh each time it opens, so the choices reset. The web's NewChallengeSheet (src/screens/Victory/).
 */
export function NewChallengeForm({ defaultVariant, today, onClose }: NewChallengeFormProps) {
  const { colors, fonts } = useTheme()
  const [variant, setVariant] = useState<ChallengeVariant>(defaultVariant)
  const nowMin = useNowMinutes()
  const start = useStartChoice(today, undefined, defaultStartChoice(nowMin))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const begin = async () => {
    if (start.dateError) return
    setBusy(true)
    setError(null)
    try {
      await challengeRepo.startNew(start.startDate, variant)
      onClose()
    } catch {
      setError("Couldn't start it — try again.")
    } finally {
      setBusy(false)
    }
  }
  const problem = start.dateError ?? error

  return (
    <View style={styles.form}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.ink, fontFamily: fonts.rounded.bold }]}>
        Start a new challenge
      </Text>
      <VariantPicker value={variant} onChange={setVariant} />
      <StartDateChoice state={start} today={today} />
      {!start.dateError && (
        <Text style={[styles.small, { color: colors.inkMuted, fontFamily: fonts.rounded.regular }]}>
          A new attempt starts on {formatDisplayDate(start.startDate)}. Every photo and stat from this one stays saved.
        </Text>
      )}
      {problem !== null && problem !== undefined && <Alert>{problem}</Alert>}
      <View style={styles.buttons}>
        <Button label={busy ? 'Starting…' : 'Start'} disabled={busy || Boolean(start.dateError)} onPress={() => void begin()} style={styles.half} />
        <Button label="Cancel" variant="secondary" disabled={busy} onPress={onClose} style={styles.half} />
      </View>
    </View>
  )
}

/** Attempts whose victory confetti already fired this session, so revisiting the tab stays calm. */
const celebratedThisSession = new Set<number>()

interface VictoryScreenProps {
  challenge: Challenge
  today: string
  /** False while the Day-75 celebration overlay still covers this screen; confetti waits until it's gone. */
  revealed: boolean
  streak: number
  missedDays: number[]
}

/** Shown on the Today tab once all 75 days are complete. The web's VictoryScreen. */
export function VictoryScreen({ challenge, today, revealed, streak, missedDays }: VictoryScreenProps) {
  const { colors, fonts } = useTheme()
  const insets = useSafeAreaInsets()
  const reduceMotion = useReduceMotion()
  const rules = rulesFor(challenge)
  const stats = useChallengeStats(challenge.id)
  const playChime = useChime()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [confetti, setConfetti] = useState(false)
  const moves = !reduceMotion && canAnimate()
  const arrive = useState(() => new Animated.Value(moves ? 0 : 1))[0]

  const onReveal = useEffectEvent(() => {
    if (celebratedThisSession.has(challenge.id)) return
    celebratedThisSession.add(challenge.id)
    setConfetti(true)
    playChime()
  })
  useEffect(() => {
    if (revealed) onReveal()
  }, [revealed])
  useEffect(() => {
    if (!moves) return
    const spring = Animated.spring(arrive, { toValue: 1, stiffness: 220, damping: 14, mass: 1, useNativeDriver: true })
    spring.start()
    return () => spring.stop()
  }, [moves, arrive])

  const endDate = dateForDayNumber(challenge.startDate, CHALLENGE_LENGTH)
  const numbers: [string, string][] = [
    ['Perfect days', `${stats.perfectDays}`],
    ['Water', `${(stats.water_ml / 1000).toFixed(1)} L`],
    ['Pages read', `${stats.pages}`],
    ['Workout time', formatMinutes(stats.workoutMinutes)],
    ['Streak', `🔥 ${streak}`],
    ...(rules.jokers > 0 ? ([['Jokers used', `${missedDays.length}/${rules.jokers}`]] as [string, string][]) : []),
  ]

  return (
    <>
      <ScrollView style={{ backgroundColor: colors.canvas }} contentContainerStyle={[styles.victory, { paddingTop: insets.top + 40 }]}>
        <Animated.View style={{ opacity: arrive, transform: [{ scale: arrive.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }}>
          <Mascot mood="triumphant" size={160} />
        </Animated.View>
        <View style={styles.centre}>
          <Text style={[styles.small, { color: colors.inkMuted, fontFamily: fonts.rounded.bold }]}>Attempt #{challenge.attemptNumber}</Text>
          <Text accessibilityRole="header" style={[styles.heading, { color: colors.ink, fontFamily: fonts.display.semibold }]}>
            {victoryTitle(rules)}
          </Text>
          <Text style={[styles.small, styles.dates, { color: colors.inkMuted, fontFamily: fonts.rounded.semibold }]}>
            {formatDisplayDate(challenge.startDate)} – {formatDisplayDate(endDate)}
          </Text>
        </View>
        <Text style={[styles.body, styles.narrow, { color: colors.inkMuted, fontFamily: fonts.rounded.regular }]}>{victoryLine(rules)}</Text>
        {/* The next step first, where the first screen shows it; the numbers below. */}
        <Button label="Start a new challenge" onPress={() => setSheetOpen(true)} style={styles.wide} />
        <Text style={[styles.hint, styles.narrow, { color: colors.inkMuted, fontFamily: fonts.rounded.regular }]}>Pick your next challenge and when it starts.</Text>
        <View style={styles.grid}>
          {numbers.map(([label, value], i) => (
            // An odd one out at the end takes the whole row.
            <View key={label} accessible accessibilityLabel={`${label}: ${value}`} style={[styles.stat, { backgroundColor: colors.surface }, i === numbers.length - 1 && numbers.length % 2 === 1 && styles.statWide]}>
              <Text style={[styles.hint, { color: colors.inkMuted, fontFamily: fonts.rounded.bold }]}>{label}</Text>
              <Text style={[styles.statValue, { color: colors.ink, fontFamily: fonts.rounded.bold }]}>{value}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      {confetti && moves && <Confetti onDone={() => setConfetti(false)} />}
      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} label="Start a new challenge">
        <NewChallengeForm defaultVariant={variantOf(challenge)} today={today} onClose={() => setSheetOpen(false)} />
      </Sheet>
    </>
  )
}

// The web's burst (canvas-confetti with particleCount 140, spread 90, startVelocity 45, origin 60% down, and the
// library's own gravity, decay and 200 ticks at 60 a second), worked out per piece as a path through time.
const PIECES = 140
const TICKS = 200
const DECAY = 0.9
const SAMPLES = 24

interface Piece {
  xs: number[]
  ys: number[]
  spin: string
  size: number
  round: boolean
  tone: number
}

function makePieces(): Piece[] {
  return Array.from({ length: PIECES }, (_, i) => {
    // Straight up, give or take half the spread; faster or slower by up to half.
    const angle = -Math.PI / 2 + ((Math.random() - 0.5) * 90 * Math.PI) / 180
    const velocity = 45 * (0.5 + Math.random() * 0.5)
    const at = (tick: number) => (velocity * (1 - DECAY ** tick)) / (1 - DECAY)
    const ticks = Array.from({ length: SAMPLES + 1 }, (_, k) => (k / SAMPLES) * TICKS)
    return {
      xs: ticks.map((tick) => Math.cos(angle) * at(tick)),
      // Thrown up, then falling 3 points a tick.
      ys: ticks.map((tick) => Math.sin(angle) * at(tick) + 3 * tick),
      spin: `${(Math.random() - 0.5) * 1440}deg`,
      size: 6 + Math.random() * 5,
      round: i % 2 === 0,
      tone: i % 5,
    }
  })
}

/** One burst of confetti in the world's shades, from 60% down the screen; then it is gone. */
function Confetti({ onDone }: { onDone: () => void }) {
  const { colors } = useTheme()
  const { width, height } = useWindowDimensions()
  const [pieces] = useState(makePieces)
  const time = useState(() => new Animated.Value(0))[0]
  const done = useEffectEvent(onDone)
  useEffect(() => {
    const fall = Animated.timing(time, { toValue: 1, duration: (TICKS / 60) * 1000, easing: Easing.linear, useNativeDriver: true })
    fall.start(({ finished }) => {
      if (finished) done()
    })
    return () => fall.stop()
  }, [time])
  // Lighter and darker than the world's fill, so the burst shows on a world-coloured field (the web's tokens).
  const tones = [colors.worldInk, colors.worldEdge, colors.worldSoft, colors.onWorld, colors.ink]
  const inputRange = Array.from({ length: SAMPLES + 1 }, (_, k) => k / SAMPLES)

  return (
    <View testID="confetti" pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
      {pieces.map((piece, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: width / 2,
            top: height * 0.6,
            width: piece.size,
            height: piece.round ? piece.size : piece.size * 0.6,
            borderRadius: piece.round ? piece.size / 2 : 1,
            backgroundColor: tones[piece.tone],
            opacity: time.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
            transform: [
              { translateX: time.interpolate({ inputRange, outputRange: piece.xs }) },
              { translateY: time.interpolate({ inputRange, outputRange: piece.ys }) },
              { rotate: time.interpolate({ inputRange: [0, 1], outputRange: ['0deg', piece.spin] }) },
            ],
          }}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  title: { fontSize: 18 },
  small: { fontSize: 14, lineHeight: 20 },
  hint: { fontSize: 12 },
  body: { fontSize: 16, lineHeight: 23 },
  narrow: { maxWidth: 320, textAlign: 'center' },
  buttons: { marginTop: 4, flexDirection: 'row', gap: 8 },
  half: { flex: 1 },
  victory: { flexGrow: 1, alignItems: 'center', gap: 16, paddingHorizontal: 24, paddingBottom: 120 },
  centre: { alignItems: 'center' },
  heading: { fontSize: 30, letterSpacing: 0.75, textAlign: 'center' },
  dates: { marginTop: 4 },
  wide: { alignSelf: 'stretch', maxWidth: 384 },
  grid: { marginTop: 8, width: '100%', maxWidth: 384, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stat: { flexBasis: '40%', flexGrow: 1, borderRadius: 20, padding: 12 },
  statWide: { flexBasis: '100%' },
  statValue: { marginTop: 4, fontSize: 20 },
})

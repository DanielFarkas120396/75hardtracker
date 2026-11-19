import { formatMinutes } from '@logic/duration'
import { formatShortDay } from '@logic/dates'
import { MOODS, type Mood } from '@logic/moods'
import type { WorkoutType } from '@logic/types'
import { workoutHistory, type ActivityHistory, type WorkoutHistory, type WorkoutSession } from '@logic/workoutHistory'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, FadeOut, LinearTransition, useAnimatedStyle, type SharedValue } from 'react-native-reanimated'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'
import { Icon } from '../components/icons/Icon'
import { dayEntryRepo } from '../db/repositories/dayEntryRepo'
import { workoutRepo } from '../db/repositories/workoutRepo'
import { useLiveQuery } from '../db/useLiveQuery'
import { useReduceMotion } from '../hooks/useReduceMotion'
import { useTheme } from '../theme/ThemeProvider'
import { mixHex, withAlpha } from '../theme/tokens'
import { ACTIVITY_ICONS } from '../today/WorkoutTask'
import { fadeInOut, phase, useLoopClock } from './loop'

const sessionsWord = (count: number) => (count === 1 ? 'session' : 'sessions')
const moodFor = (feel: Mood) => MOODS.find((mood) => mood.value === feel)!

/** An attempt's workouts grouped by activity, live. `undefined` while loading. The web's useWorkoutHistory. */
export function useWorkoutHistory(challengeId: number): WorkoutHistory | undefined {
  return useLiveQuery(async () => {
    const entries = await dayEntryRepo.getAllForChallenge(challengeId)
    const workouts = await workoutRepo.getForDayEntries(entries.map((e) => e.id))
    const entryById = new Map(entries.map((e) => [e.id, e]))
    const sessions = workouts.flatMap((w): WorkoutSession[] => {
      const entry = entryById.get(w.dayEntryId)
      return entry ? [{ ...w, dayNumber: entry.dayNumber, date: entry.date }] : []
    })
    return workoutHistory(sessions)
  }, [challengeId])
}

/**
 * Every workout of the attempt, on Stats under the tiles: the most practised activity as a full card, the others as
 * slim tabs tucked under it, most sessions first. A tapped card opens where it is. The web's WorkoutsSection.
 */
export function WorkoutsSection({ history }: { history: WorkoutHistory | undefined }) {
  const { colors, fonts, mode } = useTheme()
  const [open, setOpen] = useState<WorkoutType | null>(null)
  return (
    <View style={styles.section}>
      <View accessible accessibilityRole="header" accessibilityLabel="Workouts" style={styles.heading}>
        <Icon name="workout" color={colors.worldInk} />
        <Text style={[styles.headingText, { color: colors.ink, fontFamily: fonts.rounded.bold }]}>Workouts</Text>
      </View>
      {history &&
        (history.sessions === 0 ? (
          <View style={[styles.empty, { backgroundColor: colors.surface }, mode === 'light' && { borderWidth: 1, borderColor: withAlpha(colors.ink, 0.1) }]}>
            <Text accessibilityRole="header" style={[styles.emptyTitle, { color: colors.ink, fontFamily: fonts.display.semibold }]}>
              No workouts yet
            </Text>
            <Text style={[styles.emptyText, { color: colors.inkMuted, fontFamily: fonts.rounded.semibold }]}>Log your first one from Today.</Text>
          </View>
        ) : (
          <View>
            {history.activities.map((activity, i) => (
              <ActivityCard
                key={activity.type}
                activity={activity}
                first={i === 0}
                shade={history.activities.length > 1 ? i / (history.activities.length - 1) : 0}
                layer={history.activities.length - i}
                open={activity.type === open}
                onToggle={() => setOpen(activity.type === open ? null : activity.type)}
              />
            ))}
          </View>
        ))}
      {history && history.untried.length > 0 && <Untried types={history.untried} />}
    </View>
  )
}

/**
 * The attempt's training in numbers, high on Stats: the time trained, big, then the sessions and how many were
 * outdoors. Nothing before the first workout. The web's WorkoutTotals.
 */
export function WorkoutTotals({ history }: { history: WorkoutHistory | undefined }) {
  const { colors, fonts } = useTheme()
  if (!history || history.sessions === 0) return null
  const hours = Math.floor(history.minutes / 60)
  const minutes = history.minutes % 60
  const big = { color: colors.worldInk, fontFamily: fonts.display.bold }
  return (
    <View accessibilityLabel="This attempt" style={styles.totals}>
      <View accessible accessibilityLabel={`${formatMinutes(history.minutes)} of sweat`}>
        <Text style={[styles.time, big]}>
          {hours > 0 ? (
            <>
              {hours}
              <Text style={styles.timeUnit}>h</Text>
              {minutes > 0 ? String(minutes).padStart(2, '0') : ''}
            </>
          ) : (
            <>
              {minutes}
              <Text style={styles.timeUnit}>min</Text>
            </>
          )}
        </Text>
        <Text style={[styles.quote, { color: colors.ink, fontFamily: fonts.quote }]}>of sweat</Text>
      </View>
      <View style={[styles.rule, { backgroundColor: withAlpha(colors.ink, 0.15) }]} />
      <View style={styles.counts}>
        <Text>
          <Text style={[styles.count, { color: colors.ink, fontFamily: fonts.display.bold }]}>{history.sessions}</Text>
          <Text style={[styles.countWord, { color: colors.inkMuted, fontFamily: fonts.rounded.semibold }]}> {sessionsWord(history.sessions)}</Text>
        </Text>
        <Text>
          <Text style={[styles.count, { color: colors.ink, fontFamily: fonts.display.bold }]}>{history.outdoors}</Text>
          <Text style={[styles.countQuote, { color: colors.ink, fontFamily: fonts.quote }]}> under the sky</Text>
        </Text>
      </View>
    </View>
  )
}

interface ActivityCardProps {
  activity: ActivityHistory
  /** The top card, the most practised activity: a little bigger, starred, glowing with sparks. */
  first: boolean
  /** Where its colour sits between the stack's strongest shade (0, the top) and its softest (1). */
  shade: number
  /** Its stacking order: each card lies over the top of the next one. */
  layer: number
  open: boolean
  onToggle: () => void
}

/** One activity, tucked under the card above it: its logo, name, time and count. Tapped, it unfolds where it is. */
function ActivityCard({ activity, first, shade, layer, open, onToggle }: ActivityCardProps) {
  const { colors, fonts, mode } = useTheme()
  const reduceMotion = useReduceMotion()
  const { type, sessions, feels } = activity
  const count = sessions.length
  const ink = colors.onStack
  // The translucent wash for the feel chips and the session list (the web's bg-white/55, dark:bg-black/25).
  const wash = mode === 'light' ? 'rgba(255, 255, 255, 0.55)' : 'rgba(0, 0, 0, 0.25)'

  return (
    <Animated.View
      layout={reduceMotion ? undefined : LinearTransition.duration(300)}
      // The shadow lives out here: iOS clips a shadow on a view that clips its content.
      style={[styles.cardShadow, !first && styles.tucked, { zIndex: layer }]}
    >
      <View style={[styles.card, { backgroundColor: mixHex(colors.stackFrom, colors.stackTo, shade) }]}>
        {first && <Embers glow={colors.stackGlow} />}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${type}, ${count} ${sessionsWord(count)}`}
          accessibilityState={{ expanded: open }}
          onPress={onToggle}
          // A tucked card's top 24 points hide under the card above it, so its content starts lower.
          style={[styles.cardButton, first ? styles.firstButton : styles.tuckedButton]}
        >
          <Icon name={ACTIVITY_ICONS[type]} size={30} strokeWidth={1.8} color={ink} />
          <View style={styles.cardText}>
            <Text numberOfLines={1} style={[styles.cardTitle, { color: ink, fontFamily: fonts.rounded.bold }]}>
              {type}
            </Text>
            <View style={styles.cardLine}>
              {first && <Icon name="star" size={14} color={ink} />}
              <Text style={[styles.cardSmall, { color: ink, fontFamily: fonts.rounded.bold }]}>
                {first ? 'Your favorite · ' : ''}
                {formatMinutes(activity.minutes)}
              </Text>
            </View>
          </View>
          <Text style={[styles.cardCount, { color: ink, fontFamily: fonts.display.semibold }]}>{count}</Text>
          <View style={[styles.hint, { transform: [{ rotate: open ? '-90deg' : '90deg' }] }]}>
            <Icon name="chevron" size={14} strokeWidth={2.5} color={ink} />
          </View>
        </Pressable>

        {open && (
          <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(300)} exiting={reduceMotion ? undefined : FadeOut.duration(200)} style={styles.panel}>
            {feels.length > 0 && (
              <View accessibilityLabel="How it felt" style={styles.feels}>
                {feels.map(({ feel, count: times }) => (
                  <View key={feel} accessible accessibilityLabel={`${moodFor(feel).label}: ${times}`} style={[styles.feel, { backgroundColor: wash }]}>
                    <Text style={styles.feelEmoji}>{moodFor(feel).emoji}</Text>
                    <Text style={[styles.feelCount, { color: ink, fontFamily: fonts.rounded.bold }]}>{times}</Text>
                  </View>
                ))}
              </View>
            )}
            <View accessibilityLabel={`${type} sessions`} style={[styles.sessions, { backgroundColor: wash }]}>
              {sessions.map((session, i) => (
                <View key={session.id} style={[styles.session, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: withAlpha(ink, 0.15) }]}>
                  <View style={styles.sessionDay}>
                    <Text style={[styles.sessionTitle, { color: ink, fontFamily: fonts.rounded.bold }]}>Day {session.dayNumber}</Text>
                    <Text style={[styles.cardSmall, { color: ink, fontFamily: fonts.rounded.bold }]}>{formatShortDay(session.date)}</Text>
                  </View>
                  <Text style={[styles.sessionLength, { color: ink, fontFamily: fonts.rounded.bold }]}>
                    {session.durationMin} min · {session.isOutdoor ? 'Outdoor' : 'Indoor'}
                  </Text>
                  <View style={styles.sessionFeel}>
                    {session.feel !== undefined && (
                      <Text accessibilityRole="image" accessibilityLabel={moodFor(session.feel).label} style={styles.sessionEmoji}>
                        {moodFor(session.feel).emoji}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </Animated.View>
        )}
      </View>
    </Animated.View>
  )
}

/** The favourite card's tiny sparks: fixed spots (no randomness), each with its own pace (the web's SPARKS). */
const SPARKS = Array.from({ length: 16 }, (_, i) => ({
  left: ((i * 61 + 7) % 96) + 2,
  top: 30 + ((i * 43) % 70),
  size: 1 + (i % 2),
  opacity: 0.45 + ((i * 7) % 5) / 10,
  duration: 3 + ((i * 5) % 7) / 2,
  delay: (i * 0.7) % 6,
  dx: ((i * 13) % 25) - 12,
}))

/** A warm glow rising from below the favourite card, with tiny sparks drifting up (still with Reduce Motion). */
function Embers({ glow }: { glow: string }) {
  const clock = useLoopClock()
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
      <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none">
        <Defs>
          <RadialGradient id="ember-glow" cx="50%" cy="120%" rx="65%" ry="90%">
            <Stop offset="0" stopColor={glow} stopOpacity={1} />
            <Stop offset="0.7" stopColor={glow} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#ember-glow)" />
      </Svg>
      {SPARKS.map((spark, i) => (
        <Spark key={i} clock={clock} spark={spark} />
      ))}
    </View>
  )
}

/** One spark rising from 40 points below its spot to 70 above, drifting sideways, fading (the web's `ember-rise`). */
function Spark({ clock, spark }: { clock: SharedValue<number>; spark: (typeof SPARKS)[number] }) {
  const style = useAnimatedStyle(() => {
    if (clock.value === 0) return { opacity: spark.opacity, transform: [{ translateX: 0 }, { translateY: 0 }] }
    const p = phase(clock.value, spark.duration, spark.delay)
    return { opacity: fadeInOut(p, spark.opacity, 0.2), transform: [{ translateX: spark.dx * p }, { translateY: 40 - 110 * p }] }
  })
  return <Animated.View style={[styles.spark, { left: `${spark.left}%`, top: `${spark.top}%`, width: spark.size, height: spark.size }, style]} />
}

function Untried({ types }: { types: readonly WorkoutType[] }) {
  const { colors, fonts, mode } = useTheme()
  return (
    <View>
      <Text style={[styles.untriedTitle, { color: colors.inkMuted, fontFamily: fonts.rounded.bold }]}>Not tried yet</Text>
      <View accessibilityLabel="Not tried yet" style={styles.untried}>
        {types.map((type) => (
          <View
            key={type}
            style={[styles.untriedChip, { backgroundColor: colors.surface }, mode === 'light' && { borderWidth: 1, borderColor: withAlpha(colors.ink, 0.1) }]}
          >
            <Icon name={ACTIVITY_ICONS[type]} size={24} strokeWidth={1.8} color={colors.inkMuted} />
            <Text style={[styles.untriedText, { color: colors.inkMuted, fontFamily: fonts.rounded.bold }]}>{type}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  section: { gap: 16 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  headingText: { fontSize: 18 },
  empty: { alignItems: 'center', borderRadius: 20, padding: 20 },
  emptyTitle: { fontSize: 20, letterSpacing: 0.5 },
  emptyText: { marginTop: 4, fontSize: 14 },
  totals: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 4 },
  time: { fontSize: 72, lineHeight: 70, letterSpacing: 1.8 },
  timeUnit: { fontSize: 36 },
  quote: { marginTop: 4, fontSize: 16 },
  rule: { width: 1, alignSelf: 'stretch' },
  counts: { gap: 10 },
  count: { fontSize: 36, letterSpacing: 0.9 },
  countWord: { fontSize: 14 },
  countQuote: { fontSize: 14 },
  card: { overflow: 'hidden', borderRadius: 32 },
  cardShadow: {
    borderRadius: 32,
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
  },
  tucked: { marginTop: -24 },
  cardButton: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20 },
  firstButton: { paddingVertical: 28 },
  tuckedButton: { paddingTop: 36, paddingBottom: 12 },
  cardText: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 18, lineHeight: 22 },
  cardLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardSmall: { fontSize: 12 },
  cardCount: { minWidth: 28, textAlign: 'right', fontSize: 30, lineHeight: 32, letterSpacing: 0.75 },
  hint: { marginRight: -6, opacity: 0.5 },
  panel: { paddingHorizontal: 20, paddingBottom: 16 },
  feels: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  feel: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingVertical: 2, paddingLeft: 6, paddingRight: 10 },
  feelEmoji: { fontSize: 18 },
  feelCount: { fontSize: 14 },
  sessions: { marginTop: 12, borderRadius: 20, paddingHorizontal: 14 },
  session: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  sessionDay: { flex: 1 },
  sessionTitle: { fontSize: 16 },
  sessionLength: { fontSize: 14 },
  sessionFeel: { width: 28, alignItems: 'center' },
  sessionEmoji: { fontSize: 20 },
  spark: { position: 'absolute', borderRadius: 1, backgroundColor: '#ffd59a', shadowColor: '#ffb464', shadowOpacity: 0.75, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
  untriedTitle: { paddingHorizontal: 4, fontSize: 12, letterSpacing: 0.3, textTransform: 'uppercase' },
  untried: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  untriedChip: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingVertical: 6, paddingLeft: 8, paddingRight: 14 },
  untriedText: { fontSize: 14 },
})

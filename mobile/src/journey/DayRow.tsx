import type { DayStatus } from '@logic/journeyLog'
import { formatMinutes } from '@logic/duration'
import { formatShortDay } from '@logic/dates'
import { Image, Pressable, StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { Icon } from '../components/icons/Icon'
import type { DayEntry, Workout } from '../db/types'
import { useReduceMotion } from '../hooks/useReduceMotion'
import { useTheme } from '../theme/ThemeProvider'
import { mixHex, withAlpha } from '../theme/tokens'
import { ACTIVITY_ICONS } from '../today/WorkoutTask'

export interface DayRowProps {
  dayNumber: number
  date: string
  status: DayStatus
  entry?: DayEntry
  workouts: Workout[]
  /** The day's photo, as a file to show. */
  photoUri?: string
  /** Opens the day's card, from the point tapped. */
  onOpen: (from: { x: number; y: number }) => void
  onLayout?: (event: LayoutChangeEvent) => void
}

/**
 * One day in the logbook: its photo, the first line of its notes, its workouts. The web's DayRow
 * (src/screens/Journey/DayRow.tsx). Lives inside its world's WorldScope.
 */
export function DayRow({ dayNumber, date, status, entry, workouts, photoUri, onOpen, onLayout }: DayRowProps) {
  const { colors, fonts } = useTheme()
  const reduceMotion = useReduceMotion()
  const open = (event: GestureResponderEvent) => onOpen({ x: event.nativeEvent.pageX, y: event.nativeEvent.pageY })

  if (status === 'joker') {
    return (
      <Pressable accessibilityRole="button" onPress={open} onLayout={onLayout} style={[styles.joker, { borderColor: withAlpha(colors.ink, 0.2) }]}>
        <Text style={[styles.jokerText, { color: colors.inkMuted, fontFamily: fonts.rounded.regular }]}>Day {dayNumber} · forgiven with a joker</Text>
        <Text accessibilityElementsHidden importantForAccessibility="no">
          🃏
        </Text>
      </Pressable>
    )
  }

  const today = status === 'today'
  const subtitle = today ? (entry?.completed ? 'Done' : 'In progress') : status === 'restored' ? 'Not in your backup' : status === 'open' ? 'Not finished' : formatShortDay(date)
  const firstLine = entry?.notes?.trim().split('\n')[0]

  return (
    <Pressable
      accessibilityRole="button"
      onPress={open}
      onLayout={onLayout}
      style={({ pressed }) => [
        styles.row,
        today && { backgroundColor: colors.worldSoft, borderWidth: 2, borderColor: colors.world },
        pressed && !reduceMotion && styles.pressed,
      ]}
    >
      {!today && (
        // A faint wash of the world's colour from the photo side, so each chapter reads as its world.
        <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="wash" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={mixHex(colors.surface, colors.world, 0.14)} />
              <Stop offset="1" stopColor={mixHex(colors.surface, colors.world, 0.04)} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#wash)" />
        </Svg>
      )}
      <View style={[styles.thumb, { backgroundColor: colors.canvas }]}>
        {photoUri !== undefined ? (
          <Image source={{ uri: photoUri }} accessibilityLabel={`Progress photo, Day ${dayNumber}`} style={StyleSheet.absoluteFill} />
        ) : (
          entry?.photoId == null && <Icon name="photo" size={20} color={colors.inkMuted} />
        )}
      </View>
      <View style={styles.text}>
        <Text style={[styles.title, { color: colors.worldInk, fontFamily: fonts.display.semibold }]}>{today ? `Today · Day ${dayNumber}` : `Day ${dayNumber}`}</Text>
        <Text style={[styles.subtitle, { color: colors.inkMuted, fontFamily: fonts.rounded.regular }]}>{today ? `${formatShortDay(date)} · ${subtitle}` : subtitle}</Text>
        {firstLine ? (
          <Text numberOfLines={1} style={[styles.notes, { color: colors.ink, fontFamily: fonts.rounded.regular }]}>
            {firstLine}
          </Text>
        ) : null}
        {workouts.length > 0 && (
          <View accessibilityLabel="Workouts" style={styles.workouts}>
            {workouts.map((workout) => (
              <View key={workout.id} style={[styles.workout, { backgroundColor: withAlpha(colors.world, 0.15) }]}>
                <Icon name={ACTIVITY_ICONS[workout.type]} size={14} color={colors.worldInk} label={workout.type} />
                <Text style={[styles.minutes, { color: colors.worldInk, fontFamily: fonts.rounded.semibold }]}>{formatMinutes(workout.durationMin)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  joker: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  jokerText: { fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden', borderRadius: 20, padding: 10 },
  pressed: { transform: [{ scale: 0.98 }] },
  thumb: { width: 56, height: 72, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 12 },
  text: { flex: 1, minWidth: 0 },
  title: { fontSize: 18, lineHeight: 19, letterSpacing: 0.45, textTransform: 'uppercase' },
  subtitle: { marginTop: 4, fontSize: 12 },
  notes: { marginTop: 4, fontSize: 14 },
  workouts: { marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  workout: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  minutes: { fontSize: 12 },
})

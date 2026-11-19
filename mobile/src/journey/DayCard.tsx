import { formatMinutes } from '@logic/duration'
import { formatShortDay } from '@logic/dates'
import { useEffect, useMemo, useState } from 'react'
import { Animated, Image, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { Icon } from '../components/icons/Icon'
import type { DayEntry, Workout } from '../db/types'
import { useReduceMotion } from '../hooks/useReduceMotion'
import { useTheme } from '../theme/ThemeProvider'
import { ACTIVITY_ICONS } from '../today/WorkoutTask'
import { useCurtained } from '../lock/store'

export interface OpenDay {
  dayNumber: number
  date: string
  /** The day's entry; none on a day nothing was logged (a joker can forgive one). */
  entry?: DayEntry
  workouts: Workout[]
  photoUri?: string
  /** A day the restored backup didn't contain: counted as done, its logs are gone. */
  restored?: boolean
  /** The point tapped, on screen: the card grows out of it and shrinks back into it. */
  from: { x: number; y: number }
}

interface DayCardProps {
  /** The day shown; kept while the card closes, so it can shrink back with its content. */
  day: OpenDay | null
  open: boolean
  onClose: () => void
}

/** How far down (points) or how fast (points a second) a drag on the handle closes the card: the web's 80 and 500. */
const DRAG_CLOSE = 80
const FLING_CLOSE = 500

/** Whether a drag on the handle, let go `dy` points down at `vy` points a millisecond, closes the card. */
export function dragCloses(dy: number, vy: number): boolean {
  return dy > DRAG_CLOSE || vy * 1000 > FLING_CLOSE
}

/**
 * A past day on the Journey: its photo, its notes and its workouts, in a centred card that grows from the row tapped
 * and closes from Close, a tap beside it or a drag down on its top. Reduce motion: a fade. The web's DayCard and the
 * centred Modal it opens in (src/screens/Journey/DayCard.tsx, src/components/ui/Modal.tsx).
 */
export function DayCard({ day, open, onClose }: DayCardProps) {
  const { colors, fonts } = useTheme()
  const reduceMotion = useReduceMotion()
  const { width, height } = useWindowDimensions()
  const shown = useState(() => new Animated.Value(0))[0]
  const drag = useState(() => new Animated.Value(0))[0]
  const visible = open && day !== null
  // Mounted from the moment it opens until it has shrunk away.
  const [mounted, setMounted] = useState(visible)
  if (visible && !mounted) setMounted(true)

  useEffect(() => {
    if (visible) {
      drag.setValue(0)
      const opening = reduceMotion
        ? Animated.timing(shown, { toValue: 1, duration: 150, useNativeDriver: true })
        : Animated.spring(shown, { toValue: 1, stiffness: 300, damping: 28, mass: 1, useNativeDriver: true })
      opening.start()
      return () => opening.stop()
    }
    const closing = reduceMotion
      ? Animated.timing(shown, { toValue: 0, duration: 150, useNativeDriver: true })
      : Animated.spring(shown, { toValue: 0, stiffness: 300, damping: 28, mass: 1, useNativeDriver: true, restDisplacementThreshold: 0.01 })
    closing.start(({ finished }) => {
      if (finished) setMounted(false)
    })
    return () => closing.stop()
  }, [visible, shown, drag, reduceMotion])

  // The top of the card is its handle: dragged down far or fast enough, it closes; otherwise it springs back.
  const handle = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_, gesture) => drag.setValue(Math.max(0, gesture.dy) * 0.8),
        onPanResponderRelease: (_, gesture) => {
          if (dragCloses(gesture.dy, gesture.vy)) onClose()
          else Animated.spring(drag, { toValue: 0, stiffness: 300, damping: 28, useNativeDriver: true }).start()
        },
        onPanResponderTerminate: () => Animated.spring(drag, { toValue: 0, stiffness: 300, damping: 28, useNativeDriver: true }).start(),
      }),
    [drag, onClose],
  )

  const from = day?.from ?? { x: width / 2, y: height / 2 }
  const grow = reduceMotion
    ? []
    : [
        { translateX: shown.interpolate({ inputRange: [0, 1], outputRange: [from.x - width / 2, 0] }) },
        { translateY: shown.interpolate({ inputRange: [0, 1], outputRange: [from.y - height / 2, 0] }) },
        { scale: shown.interpolate({ inputRange: [0, 1], outputRange: [0.05, 1] }) },
      ]

  // Hidden while the app lock is closed: nothing native may sit above the lock screen.
  const curtained = useCurtained(mounted)
  return (
    <Modal visible={curtained} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.dim, { opacity: shown }]}>
        <Pressable testID="day-card-backdrop" accessible={false} onPress={onClose} style={styles.fill} />
      </Animated.View>
      <View pointerEvents="box-none" style={styles.centre}>
        <Animated.View
          accessibilityViewIsModal
          onAccessibilityEscape={onClose}
          // On its way out it takes no touch: a late tap must not act twice.
          pointerEvents={visible ? 'auto' : 'none'}
          style={[
            styles.panel,
            { maxHeight: height - 48, backgroundColor: colors.surface, opacity: shown, transform: [{ translateY: drag }, ...grow] },
          ]}
        >
          {day && (
            <>
              <View {...handle.panHandlers} testID="day-card-handle" style={styles.handle}>
                <Text accessibilityRole="header" style={[styles.title, { color: colors.ink, fontFamily: fonts.display.semibold }]}>
                  Day {day.dayNumber} <Text style={[styles.titleDate, { color: colors.inkMuted }]}>· {formatShortDay(day.date)}</Text>
                </Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.close}>
                  <Icon name="close" size={22} color={colors.inkMuted} />
                </Pressable>
              </View>
              <ScrollView contentContainerStyle={styles.body}>
                {day.restored && <Muted>Not in your backup</Muted>}
                {day.entry ? <DayDetails day={day} entry={day.entry} /> : !day.restored && <Muted>Nothing was logged this day.</Muted>}
              </ScrollView>
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  )
}

function DayDetails({ day, entry }: { day: OpenDay; entry: DayEntry }) {
  const { colors, fonts } = useTheme()
  const { height } = useWindowDimensions()
  const notes = entry.notes?.trim()
  return (
    <>
      {day.photoUri !== undefined ? (
        <Image
          source={{ uri: day.photoUri }}
          accessibilityLabel={`Progress photo, Day ${entry.dayNumber}`}
          style={[styles.photo, { height: height * 0.3 }]}
        />
      ) : (
        // While the photo loads, the same box stays empty.
        <View style={[styles.noPhoto, { backgroundColor: colors.canvas }]}>
          {entry.photoId == null && (
            <>
              <Icon name="photo" size={18} color={colors.inkMuted} />
              <Text style={[styles.muted, { color: colors.inkMuted, fontFamily: fonts.rounded.regular }]}>No photo this day</Text>
            </>
          )}
        </View>
      )}
      {notes ? <Text style={[styles.notes, { color: colors.ink, fontFamily: fonts.quote }]}>{notes}</Text> : <Muted>No notes</Muted>}
      {day.workouts.length > 0 && (
        <View accessibilityLabel="Workouts" style={styles.workouts}>
          {day.workouts.map((workout) => (
            <View key={workout.id} style={[styles.workout, { backgroundColor: colors.canvas }]}>
              <Icon name={ACTIVITY_ICONS[workout.type]} size={18} color={colors.worldInk} label={workout.type} />
              <Text style={[styles.minutes, { color: colors.ink, fontFamily: fonts.rounded.bold }]}>{formatMinutes(workout.durationMin)}</Text>
            </View>
          ))}
        </View>
      )}
    </>
  )
}

function Muted({ children }: { children: string }) {
  const { colors, fonts } = useTheme()
  return <Text style={[styles.muted, styles.line, { color: colors.inkMuted, fontFamily: fonts.rounded.regular }]}>{children}</Text>
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  dim: { backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  centre: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', padding: 24 },
  panel: { width: '100%', maxWidth: 384, overflow: 'hidden', borderRadius: 20 },
  handle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 4 },
  title: { flexShrink: 1, fontSize: 24, lineHeight: 26, letterSpacing: 0.6 },
  titleDate: { fontSize: 16 },
  close: { width: 48, height: 48, marginRight: -12, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 24, paddingBottom: 24 },
  line: { marginTop: 12 },
  muted: { fontSize: 14 },
  photo: { marginTop: 12, width: '100%', borderRadius: 16 },
  noPhoto: { marginTop: 12, height: 80, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16 },
  notes: { marginTop: 12, fontSize: 16, lineHeight: 26 },
  workouts: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  workout: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  minutes: { fontSize: 14 },
})

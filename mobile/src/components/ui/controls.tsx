import { MOODS, type Mood } from '@logic/moods'
import { useEffect, useState, type ReactNode } from 'react'
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { useTheme } from '../../theme/ThemeProvider'
import { withAlpha } from '../../theme/tokens'

// The web's small controls (src/components/ui/Stepper.tsx, Toggle.tsx, DoneBadge.tsx, and MoodPicker.tsx).

interface StepperProps {
  value: number
  /** Called with a signed step (+step / -step), never the result: the caller applies it in one write, so quick taps all count. */
  onStep: (delta: number) => void
  step?: number
  min?: number
  max?: number
  unit?: string
}

/** A − / + stepper: workout minutes, pages, millilitres. */
export function Stepper({ value, onStep, step = 1, min = 0, max = Infinity, unit }: StepperProps) {
  const { colors, fonts } = useTheme()
  const atMin = value <= min
  const atMax = value >= max
  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Decrease"
        accessibilityState={{ disabled: atMin }}
        disabled={atMin}
        onPress={() => onStep(-step)}
        style={({ pressed }) => [styles.round, { backgroundColor: withAlpha(colors.ink, 0.08) }, atMin && styles.faded, pressed && styles.pressed]}
      >
        <Text style={[styles.sign, { color: colors.ink, fontFamily: fonts.rounded.semibold }]}>−</Text>
      </Pressable>
      <Text style={[styles.value, { color: colors.ink, fontFamily: fonts.rounded.bold }]}>
        {value}
        {unit ? <Text style={[styles.unit, { color: colors.inkMuted, fontFamily: fonts.rounded.semibold }]}> {unit}</Text> : null}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Increase"
        accessibilityState={{ disabled: atMax }}
        disabled={atMax}
        onPress={() => onStep(step)}
        style={({ pressed }) => [styles.round, { backgroundColor: colors.world }, atMax && styles.faded, pressed && styles.pressed]}
      >
        <Text style={[styles.sign, { color: colors.onWorld, fontFamily: fonts.rounded.semibold }]}>+</Text>
      </Pressable>
    </View>
  )
}

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  /** A decoration before the label; not part of the switch's name. */
  icon?: ReactNode
  /** The world's colour by default; blue where the task is about water or the outdoors. */
  activeColor?: 'world' | 'blue'
}

/** A pill switch with its label, for yes-or-no tasks (diet followed, outdoor…). */
export function Toggle({ checked, onChange, label, icon, activeColor = 'world' }: ToggleProps) {
  const { colors, fonts } = useTheme()
  const on = activeColor === 'blue' ? colors.blueInk : colors.worldInk
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={[styles.toggle, { backgroundColor: colors.canvas }]}
    >
      <View style={styles.toggleLabel}>
        {icon}
        <Text style={[styles.toggleText, { color: colors.ink, fontFamily: fonts.rounded.bold }]}>{label}</Text>
      </View>
      <Track checked={checked} on={on} width={48} height={28} thumb={20} thumbOn={colors.surface} />
    </Pressable>
  )
}

interface TrackProps {
  checked: boolean
  /** The track's colour when on. */
  on: string
  width: number
  height: number
  thumb: number
  /** The thumb's colour when on; white when off, so "off" never reads as "on". */
  thumbOn?: string
}

/** A switch's track and thumb. */
export function Track({ checked, on, width, height, thumb, thumbOn = '#ffffff' }: TrackProps) {
  const { colors } = useTheme()
  const gap = (height - thumb) / 2
  return (
    <View style={[styles.track, { width, height, backgroundColor: checked ? on : withAlpha(colors.ink, 0.2) }]}>
      <View
        style={[
          styles.thumb,
          { width: thumb, height: thumb, backgroundColor: checked ? thumbOn : '#ffffff', transform: [{ translateX: checked ? width - thumb - gap : gap }] },
        ]}
      />
    </View>
  )
}

const BURST_PARTICLES = 8
const BURST_DISTANCE = 28

/** Dots that fly out once from behind a done badge (the web's Burst). None under reduce motion. */
export function Burst() {
  const { colors } = useTheme()
  const reduceMotion = useReduceMotion()
  const out = useState(() => new Animated.Value(0))[0]
  useEffect(() => {
    const flight = Animated.timing(out, { toValue: 1, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: true })
    flight.start()
    return () => flight.stop()
  }, [out])
  if (reduceMotion) return null
  const tones = [colors.world, colors.yellow, colors.blue, colors.orange]
  return (
    <View testID="burst" pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, styles.burst]}>
      {Array.from({ length: BURST_PARTICLES }, (_, i) => {
        const angle = (i / BURST_PARTICLES) * 2 * Math.PI
        return (
          <Animated.View
            key={i}
            style={[
              styles.burstDot,
              { backgroundColor: tones[i % tones.length] },
              {
                opacity: out.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                transform: [
                  { translateX: out.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(angle) * BURST_DISTANCE] }) },
                  { translateY: out.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(angle) * BURST_DISTANCE] }) },
                ],
              },
            ]}
          />
        )
      })}
    </View>
  )
}

/** The round tick in the world's colour that marks a done task. With `pop` it springs in from nothing. */
export function DoneBadge({ pop }: { pop: boolean }) {
  const { colors, fonts } = useTheme()
  const reduceMotion = useReduceMotion()
  const springs = pop && !reduceMotion
  const scale = useState(() => new Animated.Value(springs ? 0 : 1))[0]
  useEffect(() => {
    // Reduce motion may only be known after the first frame: the tick is then simply there.
    if (!springs) return scale.setValue(1)
    const spring = Animated.spring(scale, { toValue: 1, stiffness: 500, damping: 14, mass: 1, useNativeDriver: true })
    spring.start()
    return () => spring.stop()
  }, [scale, springs])
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.badge, { backgroundColor: colors.world, transform: [{ scale }] }]}
    >
      <Text style={[styles.badgeTick, { color: colors.onWorld, fontFamily: fonts.rounded.bold }]}>✓</Text>
    </Animated.View>
  )
}

interface MoodPickerProps {
  /** The group's name for VoiceOver. */
  label: string
  value: Mood | undefined
  /** The mood tapped; callers clear the value when it's the one already chosen. */
  onPick: (mood: Mood) => void
  /** The chosen mood's look, in its task's colour. */
  selected: { fill: string; ring: string }
  /** The other moods' background, set against what's behind the row. */
  idleFill?: string
}

/** The five moods of "How was today?", worst to best, as emoji buttons. */
export function MoodPicker({ label, value, onPick, selected, idleFill }: MoodPickerProps) {
  const { colors, fonts } = useTheme()
  return (
    <View accessibilityLabel={label} style={styles.moods}>
      {MOODS.map((mood) => {
        const chosen = value === mood.value
        return (
          <Pressable
            key={mood.value}
            accessibilityRole="button"
            accessibilityLabel={mood.label}
            accessibilityState={{ selected: chosen }}
            onPress={() => onPick(mood.value)}
            style={[
              styles.mood,
              { backgroundColor: chosen ? selected.fill : (idleFill ?? colors.canvas) },
              chosen && { borderWidth: 2, borderColor: selected.ring, transform: [{ scale: 1.05 }] },
            ]}
          >
            <Text style={styles.moodEmoji}>{mood.emoji}</Text>
            <Text style={[styles.moodLabel, { color: colors.inkMuted, fontFamily: fonts.rounded.bold }]}>{mood.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  // 44 on the web; 48 here, the phone's own minimum.
  round: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24 },
  faded: { opacity: 0.4 },
  pressed: { transform: [{ scale: 0.95 }] },
  sign: { fontSize: 20 },
  value: { minWidth: 64, textAlign: 'center', fontSize: 20 },
  unit: { fontSize: 14 },
  toggle: {
    minHeight: 48,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  toggleLabel: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleText: { flexShrink: 1, fontSize: 16 },
  track: { justifyContent: 'center', borderRadius: 999 },
  thumb: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  burst: { alignItems: 'center', justifyContent: 'center' },
  burstDot: { position: 'absolute', width: 6, height: 6, borderRadius: 3 },
  badge: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  badgeTick: { fontSize: 14 },
  moods: { alignSelf: 'stretch', flexDirection: 'row', gap: 4 },
  mood: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 16, paddingVertical: 4 },
  moodEmoji: { fontSize: 24 },
  moodLabel: { fontSize: 11 },
})

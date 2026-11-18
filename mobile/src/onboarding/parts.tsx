import { useEffect, useRef, type ComponentRef, type ReactNode } from 'react'
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View, type TextStyle } from 'react-native'
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg'
import { useReduceMotion } from '../hooks/useReduceMotion'
import { useTheme } from '../theme/ThemeProvider'
import { withAlpha } from '../theme/tokens'

/**
 * A step's title: VoiceOver's focus moves to it as the step appears, so the new
 * question is read. The web's GateHeading (src/screens/RestartFlow/GateHeading.tsx).
 */
export function StepTitle({ children, size = 'md' }: { children: ReactNode; size?: 'md' | 'lg' }) {
  const { colors, fonts } = useTheme()
  const heading = useRef<ComponentRef<typeof Text>>(null)
  useEffect(() => {
    if (heading.current) AccessibilityInfo.sendAccessibilityEvent(heading.current, 'focus')
  }, [])
  return (
    <Text
      ref={heading}
      accessibilityRole="header"
      style={[
        styles.title,
        size === 'lg' ? styles.titleLarge : styles.titleMedium,
        { color: colors.ink, fontFamily: fonts.display.semibold },
      ]}
    >
      {children}
    </Text>
  )
}

/** The line under a title. */
export function Lead({ children, style }: { children: ReactNode; style?: TextStyle }) {
  const { colors, fonts } = useTheme()
  return <Text style={[styles.lead, { color: colors.inkMuted, fontFamily: fonts.rounded.regular }, style]}>{children}</Text>
}

/** Under a disabled button: what's missing to move on. */
export function MissingHint({ children }: { children: ReactNode }) {
  const { colors, fonts } = useTheme()
  return <Text style={[styles.hint, { color: colors.inkMuted, fontFamily: fonts.rounded.regular }]}>{children}</Text>
}

export function Alert({ children }: { children: ReactNode }) {
  const { colors, fonts } = useTheme()
  return (
    <Text accessibilityRole="alert" style={[styles.alert, { color: colors.dangerInk, fontFamily: fonts.rounded.semibold }]}>
      {children}
    </Text>
  )
}

/** The look of the flow's text fields (the web's FIELD class). 18 points: never under 16 on a field. */
export function useFieldStyle(): TextStyle {
  const { colors, fonts } = useTheme()
  return {
    alignSelf: 'stretch',
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: withAlpha(colors.ink, 0.15),
    backgroundColor: colors.canvas,
    paddingHorizontal: 16,
    color: colors.ink,
    fontFamily: fonts.rounded.bold,
    fontSize: 18,
  }
}

interface TopBarProps {
  index: number
  total: number
  onBack: () => void
  /** Once the deal is signed, there's no going back. */
  hideBack: boolean
}

/** Back (from the second screen on) and how far along the flow is: empty on the welcome, full on the deal. */
export function TopBar({ index, total, onBack, hideBack }: TopBarProps) {
  const { colors } = useTheme()
  const reduceMotion = useReduceMotion()
  const target = total > 1 ? index / (total - 1) : 1
  const progress = useRef(new Animated.Value(target)).current
  useEffect(() => {
    if (reduceMotion) progress.setValue(target)
    else Animated.timing(progress, { toValue: target, duration: 300, useNativeDriver: false }).start()
  }, [progress, target, reduceMotion])

  return (
    <View style={styles.topBar}>
      {index > 0 && !hideBack ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={styles.back}>
          <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={colors.ink} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M15 5l-7 7 7 7" />
          </Svg>
        </Pressable>
      ) : (
        <View style={styles.back} />
      )}
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="Setup progress"
        accessibilityValue={{ min: 1, max: total, now: index + 1, text: `Step ${index + 1} of ${total}` }}
        style={[styles.track, { backgroundColor: withAlpha(colors.ink, 0.1) }]}
      >
        <Animated.View
          style={[
            styles.fill,
            { backgroundColor: colors.world, width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
          ]}
        />
      </View>
    </View>
  )
}

/** The world's glow behind the duck (the web's .world-glow radial gradient). */
export function DuckGlow() {
  const { colors } = useTheme()
  return (
    <View pointerEvents="none" style={styles.glow}>
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="world-glow" cx="50%" cy="30%" rx="60%" ry="55%">
            <Stop offset={0} stopColor={colors.world} stopOpacity={0.42} />
            <Stop offset={0.5} stopColor={colors.world} stopOpacity={0.1} />
            <Stop offset={0.72} stopColor={colors.world} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#world-glow)" />
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  title: { marginTop: 16, textAlign: 'center', letterSpacing: 0.6 },
  titleMedium: { fontSize: 24, lineHeight: 30 },
  titleLarge: { fontSize: 36, lineHeight: 38, textTransform: 'uppercase' },
  lead: { marginTop: 8, fontSize: 16, lineHeight: 23, textAlign: 'center' },
  hint: { marginTop: 8, fontSize: 14, textAlign: 'center' },
  alert: { marginTop: 12, fontSize: 14, textAlign: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 48, height: 48, marginLeft: -12, alignItems: 'center', justifyContent: 'center' },
  track: { flex: 1, height: 8, overflow: 'hidden', borderRadius: 999 },
  fill: { height: '100%', borderRadius: 999 },
  glow: { position: 'absolute', left: -176, right: -176, top: -112, bottom: -48 },
})

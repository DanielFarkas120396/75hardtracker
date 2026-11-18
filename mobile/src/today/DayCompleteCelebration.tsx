import { CHALLENGE_LENGTH } from '@logic/constants'
import { worldSpanForDay, type WorldSpan } from '@logic/worlds'
import * as Haptics from 'expo-haptics'
import { useEffect, useEffectEvent, useState } from 'react'
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg'
import { FlameStreak } from '../components/FlameStreak'
import { Mascot } from '../components/mascot/Mascot'
import { Button } from '../components/ui/Button'
import type { DayCelebration } from '../hooks/useDayCompleteCelebration'
import { useReduceMotion } from '../hooks/useReduceMotion'
import { useChime } from '../hooks/useSound'
import { useHideTabBar } from '../hooks/useTabBar'
import { useTheme } from '../theme/ThemeProvider'
import { canAnimate } from './boardSettle'

/** When today's stone lights up, once the burst around it has started. */
export const STONE_LIGHTS_MS = 900

/** The won day's ring and burst: gold in every world, so a grey world's peak still shines (the Journey's Day 75 flag). */
export const WON_GOLD = '#f3c23a'

const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1)

interface DayCompleteCelebrationProps {
  celebration: DayCelebration | null
  onDismiss: () => void
}

/**
 * Full-screen "Day N done." overlay, shown the moment all five tasks are done: the world's sunrise behind the duck,
 * embers rising, and a short stretch of the climb where today's stone lights up. It covers the tabs. The web's
 * DayCompleteCelebration; not a Modal, since a sheet may still be on its way out.
 */
export function DayCompleteCelebration({ celebration, onDismiss }: DayCompleteCelebrationProps) {
  // Read here, long before a day is won: the peak itself opens too fast to learn whether sounds are on.
  const playChime = useChime()
  if (!celebration) return null
  return <Peak key={celebration.dayNumber} celebration={celebration} playChime={playChime} onDismiss={onDismiss} />
}

function Peak({ celebration, playChime, onDismiss }: { celebration: DayCelebration; playChime: () => void; onDismiss: () => void }) {
  const { colors, fonts } = useTheme()
  const insets = useSafeAreaInsets()
  const reduceMotion = useReduceMotion()
  const moves = !reduceMotion && canAnimate()
  useHideTabBar()
  const shown = useState(() => new Animated.Value(0))[0]
  const title = useState(() => new Animated.Value(moves ? 0 : 1))[0]

  const opened = useEffectEvent(() => {
    playChime()
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined)
    AccessibilityInfo.announceForAccessibility(`Day ${celebration.dayNumber} done.`)
  })
  useEffect(() => {
    opened()
    const fade = Animated.timing(shown, { toValue: 1, duration: 200, useNativeDriver: true })
    const rise = Animated.timing(title, { toValue: 1, duration: 600, delay: 300, easing: EASE_OUT, useNativeDriver: true })
    fade.start()
    rise.start()
    return () => {
      fade.stop()
      rise.stop()
    }
  }, [shown, title])

  const line = celebration.isFinalDay
    ? `That was the last one. All ${CHALLENGE_LENGTH} days, every task, every day.`
    : celebration.late
      ? 'Logged just in time. The streak lives. Now go get today.'
      : `One more stone. ${CHALLENGE_LENGTH - celebration.dayNumber} to go.`

  return (
    <Animated.View accessibilityViewIsModal style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: colors.canvas, opacity: shown }]}>
      <Sunrise moves={moves} />
      {moves && <Embers />}
      <View style={[styles.content, { paddingBottom: insets.bottom }]}>
        {/* For the eyes: the line below says it in words ("One more stone"). */}
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.scene}>
          <View style={styles.duck}>
            <Mascot mood="celebrating" size={108} />
          </View>
          <ClimbStretch dayNumber={celebration.dayNumber} streak={celebration.streak} moves={moves} />
        </View>
        <Animated.View
          accessible
          accessibilityRole="header"
          accessibilityLabel={`Day ${celebration.dayNumber} done.`}
          style={{ alignItems: 'center', opacity: title, transform: [{ translateY: title.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}
        >
          <Text style={[styles.day, { color: colors.ink, fontFamily: fonts.display.semibold }]}>Day {celebration.dayNumber}</Text>
          <Text style={[styles.done, { color: colors.worldInk, fontFamily: fonts.rounded.bold }]}>done.</Text>
        </Animated.View>
        <Text style={[styles.line, { color: colors.inkMuted, fontFamily: fonts.rounded.semibold }]}>{line}</Text>
        {celebration.streak > 1 && (
          <View accessible accessibilityLabel={`${celebration.streak} day streak`} style={styles.streak}>
            <FlameStreak streak={celebration.streak} grow={false} />
            <Text style={[styles.streakText, { color: colors.ink, fontFamily: fonts.rounded.bold }]}>day streak</Text>
          </View>
        )}
        <View style={styles.button}>
          <Button label={celebration.isFinalDay ? 'See your victory' : 'Nice!'} onPress={onDismiss} />
        </View>
      </View>
    </Animated.View>
  )
}

/** The world's sunrise, swelling up behind the duck and the stones. */
function Sunrise({ moves }: { moves: boolean }) {
  const { colors } = useTheme()
  const { width, height } = useWindowDimensions()
  const up = useState(() => new Animated.Value(moves ? 0 : 1))[0]
  useEffect(() => {
    // Up at once, also when motion stops being allowed half way.
    if (!moves) return up.setValue(1)
    const swell = Animated.timing(up, { toValue: 1, duration: 1400, easing: EASE_OUT, useNativeDriver: true })
    swell.start()
    return () => swell.stop()
  }, [moves, up])
  // The web's box: 30% wider than the screen on each side, from 5% above it to 15% below, growing from its bottom.
  const w = width * 1.6
  const h = height * 1.2
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.sunrise,
        { left: -width * 0.3, top: -height * 0.05, width: w, height: h, opacity: up, transformOrigin: 'bottom' },
        { transform: [{ scaleY: up.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] },
      ]}
    >
      <Svg width={w} height={h}>
        <Defs>
          <RadialGradient id="sunrise" cx={w * 0.5} cy={h * 0.42} rx={w * 0.48} ry={h * 0.38} gradientUnits="userSpaceOnUse">
            <Stop offset={0} stopColor={colors.world} stopOpacity={0.5} />
            <Stop offset={0.55} stopColor={colors.world} stopOpacity={0.16} />
            <Stop offset={0.78} stopColor={colors.world} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={w} height={h} fill="url(#sunrise)" />
      </Svg>
    </Animated.View>
  )
}

const hash = (n: number) => {
  const x = Math.sin(n * 127.1) * 43758.5453
  return x - Math.floor(x)
}

/** Embers drifting up from the bottom in the world's shades, twice over, then gone. None under reduce motion. */
function Embers() {
  const { colors } = useTheme()
  const { width } = useWindowDimensions()
  const tones = [colors.world, colors.worldInk, colors.worldEdge]
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: 28 }, (_, id) => (
        <Ember
          key={id}
          left={hash(id + 0.1) * width}
          size={2 + hash(id + 0.2) * 4}
          delay={hash(id + 0.3) * 2000}
          duration={2600 + hash(id + 0.4) * 2400}
          drift={(hash(id + 0.5) - 0.5) * 60}
          tone={tones[id % tones.length]}
          glow={colors.world}
        />
      ))}
    </View>
  )
}

interface EmberProps {
  left: number
  size: number
  delay: number
  duration: number
  drift: number
  tone: string
  glow: string
}

function Ember({ left, size, delay, duration, drift, tone, glow }: EmberProps) {
  const rise = useState(() => new Animated.Value(0))[0]
  useEffect(() => {
    const flight = Animated.sequence([
      Animated.delay(delay),
      Animated.loop(Animated.timing(rise, { toValue: 1, duration, easing: Easing.out(Easing.quad), useNativeDriver: true }), { iterations: 2 }),
    ])
    flight.start()
    return () => flight.stop()
  }, [rise, delay, duration])
  return (
    <Animated.View
      style={[
        styles.ember,
        { left, width: size, height: size, borderRadius: size / 2, backgroundColor: tone, shadowColor: glow, shadowRadius: size * 2 },
        {
          opacity: rise.interpolate({ inputRange: [0, 0.33, 0.66, 1], outputRange: [0, 1, 1, 0] }),
          transform: [
            { translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [20, -720] }) },
            { translateX: rise.interpolate({ inputRange: [0, 1], outputRange: [0, drift] }) },
          ],
        },
      ]}
    />
  )
}

// A zigzag up the screen: two days behind below, today in the middle, two ahead above.
const ZIGZAG = [-30, 35, 0, -35, 30]
const STEP_Y = 56
const AnimatedCircle = Animated.createAnimatedComponent(Circle)

/** A short stretch of the climb, with the Journey's own stones: today's lights up as the day is won. */
function ClimbStretch({ dayNumber, streak, moves }: { dayNumber: number; streak: number; moves: boolean }) {
  const { colors } = useTheme()
  const [timeUp, setTimeUp] = useState(false)
  // Won at once without motion, also when motion stops being allowed half way.
  const lit = timeUp || !moves
  const burst = useState(() => new Animated.Value(0))[0]
  const ring = useState(() => new Animated.Value(moves ? 0 : 1))[0]
  useEffect(() => {
    if (!moves) return ring.setValue(1)
    const timer = setTimeout(() => setTimeUp(true), STONE_LIGHTS_MS)
    // The burst's radius is drawn, not a transform: it runs on the JS thread, for 1.3 s.
    const out = Animated.timing(burst, { toValue: 1, duration: 1300, delay: STONE_LIGHTS_MS - 200, easing: Easing.out(Easing.quad), useNativeDriver: false })
    const settle = Animated.timing(ring, { toValue: 1, duration: 500, delay: STONE_LIGHTS_MS, easing: EASE_OUT, useNativeDriver: false })
    out.start()
    settle.start()
    return () => {
      clearTimeout(timer)
      out.stop()
      settle.stop()
    }
  }, [moves, burst, ring])

  const days = [-2, -1, 0, 1, 2].map((step) => dayNumber + step).filter((day) => day >= 1 && day <= CHALLENGE_LENGTH)
  const at = (day: number) => ({ x: 100 + ZIGZAG[day - dayNumber + 2], y: 150 - (day - dayNumber) * STEP_Y })
  // The streak ends today: the days it covers were won; a day behind it was forgiven with a joker.
  const stateOf = (day: number): NodeState =>
    day > dayNumber ? 'locked' : day === dayNumber ? (lit ? 'completed' : 'today') : dayNumber - day < streak ? 'completed' : 'missed'
  const today = at(dayNumber)

  return (
    <Svg width={160} height={240} viewBox="0 0 200 300" style={styles.overflow}>
      <Path
        d={days.map((day, i) => `${i === 0 ? 'M' : 'L'}${at(day).x} ${at(day).y}`).join(' ')}
        stroke={colors.world}
        strokeOpacity={0.35}
        strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray="2 12"
        fill="none"
      />
      {moves && (
        <AnimatedCircle
          cx={today.x}
          cy={today.y}
          fill={WON_GOLD}
          r={burst.interpolate({ inputRange: [0, 1], outputRange: [10, 70] })}
          opacity={burst.interpolate({ inputRange: [0, 0.001, 1], outputRange: [0, 0.9, 0] })}
        />
      )}
      {days.map((day) => (
        <ClimbStone key={day} {...at(day)} dayNumber={day} state={stateOf(day)} world={worldSpanForDay(day)} pulses={moves} />
      ))}
      {lit && (
        <AnimatedCircle
          testID="won-ring"
          cx={today.x}
          cy={today.y}
          r={ring.interpolate({ inputRange: [0, 1], outputRange: [42, 30] })}
          fill="none"
          stroke={WON_GOLD}
          strokeWidth={3.5}
          opacity={ring}
        />
      )}
    </Svg>
  )
}

export type NodeState = 'completed' | 'today' | 'locked' | 'missed'

const RADIUS = 22

const STATE_LABELS: Record<NodeState, string> = {
  completed: 'completed',
  today: 'today',
  locked: 'not reached yet',
  missed: 'forgiven with a joker',
}

interface ClimbStoneProps {
  x: number
  y: number
  dayNumber: number
  state: NodeState
  world: WorldSpan
  /** Today's ring pulses, unless nothing may move. */
  pulses: boolean
}

/** One day of the climb as a stepping stone in its world's style. The web's ClimbStone. */
export function ClimbStone({ x, y, dayNumber, state, world, pulses }: ClimbStoneProps) {
  const { fonts } = useTheme()
  const { face, rim, ink } = world.stone
  const dim = state === 'locked' || state === 'missed'
  const pulse = useState(() => new Animated.Value(0))[0]
  const beats = pulses && state === 'today'
  useEffect(() => {
    if (!beats) return
    const beat = (toValue: number) => Animated.timing(pulse, { toValue, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: false })
    const loop = Animated.loop(Animated.sequence([beat(1), beat(0)]))
    loop.start()
    return () => loop.stop()
  }, [beats, pulse])
  const offset = RADIUS * 0.72

  return (
    <G testID={`stone-${dayNumber}`} accessibilityLabel={`Day ${dayNumber}, ${STATE_LABELS[state]}`} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
      <Ellipse cy={RADIUS - 2} rx={RADIUS} ry={7} fill="#000000" opacity={0.22} />
      {state === 'today' && (
        <AnimatedCircle
          r={pulse.interpolate({ inputRange: [0, 1], outputRange: [RADIUS + 8, (RADIUS + 8) * 1.15] })}
          fill="none"
          stroke="#ff8a3d"
          strokeWidth={3.5}
          opacity={pulse.interpolate({ inputRange: [0, 1], outputRange: [0.95, 0.4] })}
        />
      )}
      <G opacity={dim ? 0.5 : 1}>
        {world.id === 'meadow' && [0, 72, 144, 216, 288].map((angle) => <Circle key={angle} r={9} cx={0} cy={-RADIUS + 2} fill={rim} transform={`rotate(${angle})`} />)}
        {world.id === 'heaven' && (
          <>
            <Circle cx={-RADIUS + 2} cy={6} r={10} fill="#ffffff" />
            <Circle cx={RADIUS - 2} cy={6} r={10} fill="#ffffff" />
          </>
        )}
        <Circle r={RADIUS} fill={face} stroke={rim} strokeWidth={4} />
        {world.id === 'hell' && <Path d="M-12 -6 L-4 -2 L-6 6 M4 -12 L2 -3 L10 2" stroke="#ffd84a" strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.7} />}
        {world.id === 'wasteland' && (
          <G fill="#5e5048" opacity={0.35}>
            <Circle cx={-10} cy={-8} r={2} />
            <Circle cx={11} cy={5} r={2.5} />
            <Circle cx={-6} cy={11} r={1.5} />
          </G>
        )}
        {world.id === 'forest' && <Circle r={RADIUS - 7} fill="none" stroke="#5b3a1e" strokeWidth={1.5} opacity={0.35} />}
        {world.id === 'mountains' && <Path d="M-14 -8 A16 16 0 0 1 -4 -16" stroke="#ffffff" strokeWidth={3} fill="none" strokeLinecap="round" />}
      </G>
      {state === 'completed' ? (
        <Path d="M-8 0 L-2 6 L9 -7" stroke={ink} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      ) : state === 'missed' ? (
        <SvgText textAnchor="middle" y={6} fontSize={18}>
          🃏
        </SvgText>
      ) : (
        <SvgText textAnchor="middle" y={5} fontSize={15} fontFamily={fonts.rounded.bold} fill={ink} opacity={state === 'locked' ? 0.75 : 1}>
          {dayNumber}
        </SvgText>
      )}
      {/* A padlock on the stone's lower-right edge, for days not reached yet. */}
      {state === 'locked' && (
        <G transform={`translate(${offset} ${offset})`}>
          <Circle r={8} fill="#ffffff" />
          <Path d="M-2.5 -0.5V-2.5a2.5 2.5 0 0 1 5 0V-0.5" fill="none" stroke="#5f6b66" strokeWidth={1.5} />
          <Rect x={-4} y={-1} width={8} height={6} rx={1.5} fill="#5f6b66" />
        </G>
      )}
    </G>
  )
}

const styles = StyleSheet.create({
  overlay: { zIndex: 50, overflow: 'hidden' },
  sunrise: { position: 'absolute' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 24 },
  scene: { flexDirection: 'row', alignItems: 'flex-end' },
  duck: { marginBottom: 32, marginRight: -8 },
  overflow: { overflow: 'visible' },
  day: { fontSize: 60, lineHeight: 62, letterSpacing: 1.5 },
  done: { fontSize: 24 },
  line: { maxWidth: 320, fontSize: 16, lineHeight: 22, textAlign: 'center' },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  streakText: { fontSize: 16 },
  button: { marginTop: 12 },
  ember: { position: 'absolute', bottom: 0, shadowOpacity: 0.55, shadowOffset: { width: 0, height: 0 } },
})

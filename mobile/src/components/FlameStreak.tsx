import { Canvas, ColorMatrix, Group, Paint, Skia, Skottie, type SkSkottieAnimation } from '@shopify/react-native-skia'
import { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Easing, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'
import fire from '../../assets/animations/fire.json'
import { useReduceMotion } from '../hooks/useReduceMotion'
import { useTheme } from '../theme/ThemeProvider'
import { canAnimate } from '../today/boardSettle'

interface FlameStreakProps {
  streak: number
  /** Grows slightly with the streak (up to 1.5×); off where space is tight, as in Today's hero. */
  grow?: boolean
}

/**
 * The frame a still flame holds (reduce motion, or no streak): the middle of fire.json's 26-frame loop, where the
 * flame stands at full height (the web's STILL_FRAME).
 */
const STILL_FRAME = 13
const WIDTH = 20
const HEIGHT = 28
const GREY = [0.2126, 0.7152, 0.0722, 0, 0, 0.2126, 0.7152, 0.0722, 0, 0, 0.2126, 0.7152, 0.0722, 0, 0, 0, 0, 0, 1, 0]

let flame: SkSkottieAnimation | null | undefined

/** The web's flame (Noto's 🔥, the same file), or null where it can't be played: the plain emoji stands in, as on the web. */
function loadFlame(): SkSkottieAnimation | null {
  if (flame === undefined) {
    try {
      flame = Skia.Skottie.Make(JSON.stringify(fire))
    } catch {
      flame = null
    }
  }
  return flame
}

/**
 * Streak flame indicator: an animated fire that grows slightly as the streak increases. It burns while the streak is
 * alive and goes out (still and grey) at 0; with reduce motion on it holds still. The web's FlameStreak
 * (src/components/FlameStreak.tsx).
 */
export function FlameStreak({ streak, grow = true }: FlameStreakProps) {
  const { colors, fonts } = useTheme()
  const reduceMotion = useReduceMotion()
  const animation = loadFlame()
  const lit = streak > 0
  const burns = lit && !reduceMotion && canAnimate()
  const frame = useSharedValue(STILL_FRAME)
  useEffect(() => {
    if (!animation || !burns) {
      frame.value = STILL_FRAME
      return
    }
    frame.value = 0
    frame.value = withRepeat(withTiming(fire.op, { duration: (fire.op / fire.fr) * 1000, easing: Easing.linear }), -1)
  }, [animation, burns, frame])
  const scale = grow ? Math.min(1.5, 1 + streak * 0.02) : 1

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Streak: ${streak} ${streak === 1 ? 'day' : 'days'}`}
      style={[styles.streak, { transform: [{ scale }] }]}
    >
      <View style={[styles.flame, !lit && styles.out]}>
        {animation ? (
          <Canvas style={StyleSheet.absoluteFill}>
            <Group
              transform={[{ scale: WIDTH / fire.w }]}
              layer={
                lit ? undefined : (
                  <Paint>
                    <ColorMatrix matrix={GREY} />
                  </Paint>
                )
              }
            >
              <Skottie animation={animation} frame={frame} />
            </Group>
          </Canvas>
        ) : (
          <Text style={styles.emoji}>🔥</Text>
        )}
      </View>
      <Text style={[styles.count, { color: lit ? colors.orangeInk : colors.inkMuted, fontFamily: fonts.rounded.bold }]}>{streak}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  streak: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  flame: { width: WIDTH, height: HEIGHT, alignItems: 'center', justifyContent: 'center' },
  out: { opacity: 0.5 },
  emoji: { fontSize: 22 },
  count: { fontSize: 18 },
})

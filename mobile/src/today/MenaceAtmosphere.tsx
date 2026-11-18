import type { MenaceLevel } from '@logic/menace'
import { useEffect, useState } from 'react'
import { Animated, StyleSheet, View } from 'react-native'
import Svg, { Defs, LinearGradient, Mask, RadialGradient, Rect, Stop } from 'react-native-svg'
import { useReduceMotion } from '../hooks/useReduceMotion'

// The web's two gradients (src/screens/Today/MenaceAtmosphere.tsx): clear in the middle, coloured at the edges.
const DARK_VIGNETTE = { color: 'rgb(40, 14, 10)', opacity: 0.26, clearTo: 0.5 }
const RED_GLOW = { color: 'rgb(190, 24, 34)', opacity: 0.4, clearTo: 0.45 }

interface MenaceAtmosphereProps {
  level: MenaceLevel
  /** Goes up by one per lunge: each flashes the screen red once. */
  flashes: number
}

/**
 * The Today screen's mood lighting, behind the content: a dark vignette when
 * time is tight, a slow red pulse (2.8 s, far below any flashing threshold)
 * when it's out, and one red flash when the duck lunges. Cards sit on top, so
 * no text is ever over it. Reduce motion stops the pulse and the flash.
 */
export function MenaceAtmosphere({ level, flashes }: MenaceAtmosphereProps) {
  const reduceMotion = useReduceMotion()
  const dark = useFade(level === 'tapping')
  const red = useFade(level === 'hunting')

  const pulse = useState(() => new Animated.Value(1))[0]
  const pulsing = level === 'hunting' && !reduceMotion
  useEffect(() => {
    if (!pulsing) return pulse.setValue(1)
    const beat = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.78, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
      ]),
    )
    beat.start()
    return () => beat.stop()
  }, [pulse, pulsing])

  const flash = useState(() => new Animated.Value(0))[0]
  useEffect(() => {
    if (flashes === 0 || reduceMotion) return
    flash.setValue(1)
    const fading = Animated.timing(flash, { toValue: 0, duration: 600, useNativeDriver: true })
    fading.start()
    return () => fading.stop()
  }, [flash, flashes, reduceMotion])

  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
      <Animated.View testID="atmosphere-dark" style={[StyleSheet.absoluteFill, { opacity: dark }]}>
        <Edges id="dark" look={DARK_VIGNETTE} />
      </Animated.View>
      <Animated.View testID="atmosphere-red" style={[StyleSheet.absoluteFill, { opacity: Animated.multiply(red, pulse) }]}>
        <Edges id="red" look={RED_GLOW} />
      </Animated.View>
      <Animated.View testID="atmosphere-flash" style={[StyleSheet.absoluteFill, { opacity: flash }]}>
        <Edges id="flash" look={RED_GLOW} />
      </Animated.View>
    </View>
  )
}

/** 0 or 1, reached over a second. */
function useFade(on: boolean): Animated.Value {
  const value = useState(() => new Animated.Value(on ? 1 : 0))[0]
  useEffect(() => {
    const fading = Animated.timing(value, { toValue: on ? 1 : 0, duration: 1000, useNativeDriver: true })
    fading.start()
    return () => fading.stop()
  }, [value, on])
  return value
}

/** One gradient over the whole screen, with the top kept clear: the header's text sits on the canvas there. */
function Edges({ id, look }: { id: string; look: typeof DARK_VIGNETTE }) {
  return (
    <Svg width="100%" height="100%">
      <Defs>
        {/* The web's "ellipse at 50% 40%" reaches the farthest corner: 1.41 times the way to the far sides. */}
        <RadialGradient id={`${id}-edges`} cx="50%" cy="40%" rx="71%" ry="85%">
          <Stop offset={look.clearTo} stopColor={look.color} stopOpacity={0} />
          <Stop offset={1} stopColor={look.color} stopOpacity={look.opacity} />
        </RadialGradient>
        <LinearGradient id={`${id}-top`} x1={0} y1={0} x2={0} y2={260} gradientUnits="userSpaceOnUse">
          <Stop offset={160 / 260} stopColor="#000000" />
          <Stop offset={1} stopColor="#ffffff" />
        </LinearGradient>
        <Mask id={`${id}-clear-top`}>
          <Rect width="100%" height="100%" fill={`url(#${id}-top)`} />
        </Mask>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id}-edges)`} mask={`url(#${id}-clear-top)`} />
    </Svg>
  )
}

import type { MenaceLevel } from '@logic/menace'
import { useEffect, useState } from 'react'
import { Animated, StyleSheet, View } from 'react-native'
import Svg, { Defs, LinearGradient, Mask, RadialGradient, Rect, Stop } from 'react-native-svg'
import { useReduceMotion } from '../hooks/useReduceMotion'

// The web's two gradients (src/screens/Today/MenaceAtmosphere.tsx): clear in the middle, coloured at the edges.
const DARK_VIGNETTE = { color: 'rgb(40, 14, 10)', opacity: 0.26, clearTo: 0.5 }
const RED_GLOW = { color: 'rgb(190, 24, 34)', opacity: 0.4, clearTo: 0.45 }
type Look = typeof DARK_VIGNETTE

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
 *
 * A layer is a full-screen drawing: each is only there while it shows.
 */
export function MenaceAtmosphere({ level, flashes }: MenaceAtmosphereProps) {
  const reduceMotion = useReduceMotion()
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
      <Layer name="dark" on={level === 'tapping'} look={DARK_VIGNETTE} />
      <Layer name="red" on={level === 'hunting'} look={RED_GLOW} pulses={!reduceMotion} />
      <Flash flashes={flashes} still={reduceMotion} />
    </View>
  )
}

/** One gradient that fades in over a second while `on`, and out over a second after. */
function Layer({ name, on, look, pulses = false }: { name: string; on: boolean; look: Look; pulses?: boolean }) {
  // Kept until it has faded out.
  const [mounted, setMounted] = useState(on)
  if (on && !mounted) setMounted(true)
  const shown = useState(() => new Animated.Value(on ? 1 : 0))[0]
  useEffect(() => {
    const fading = Animated.timing(shown, { toValue: on ? 1 : 0, duration: 1000, useNativeDriver: true })
    fading.start(({ finished }) => {
      if (finished && !on) setMounted(false)
    })
    return () => fading.stop()
  }, [shown, on])

  const beat = useState(() => new Animated.Value(1))[0]
  const pulsing = pulses && on
  useEffect(() => {
    if (!pulsing) return beat.setValue(1)
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(beat, { toValue: 0.78, duration: 1400, useNativeDriver: true }),
        Animated.timing(beat, { toValue: 1, duration: 1400, useNativeDriver: true }),
      ]),
    )
    pulse.start()
    return () => pulse.stop()
  }, [beat, pulsing])

  if (!mounted) return null
  return (
    <Animated.View testID={`atmosphere-${name}`} style={[StyleSheet.absoluteFill, { opacity: Animated.multiply(shown, beat) }]}>
      <Edges id={name} look={look} />
    </Animated.View>
  )
}

/** One red flash per lunge, fading over 0.6 s. Under reduce motion (`still`) a lunge flashes nothing. */
function Flash({ flashes, still }: { flashes: number; still: boolean }) {
  const [seen, setSeen] = useState(flashes)
  // The lunge whose flash is on screen; 0 when none is.
  const [flight, setFlight] = useState(0)
  if (seen !== flashes) {
    setSeen(flashes)
    if (!still && flashes > seen) setFlight(flashes)
  }
  const opacity = useState(() => new Animated.Value(1))[0]
  useEffect(() => {
    if (flight === 0) return
    opacity.setValue(1)
    const fading = Animated.timing(opacity, { toValue: 0, duration: 600, useNativeDriver: true })
    fading.start(({ finished }) => {
      if (finished) setFlight(0)
    })
    return () => fading.stop()
  }, [opacity, flight])

  if (flight === 0) return null
  return (
    <Animated.View testID="atmosphere-flash" style={[StyleSheet.absoluteFill, { opacity }]}>
      <Edges id="flash" look={RED_GLOW} />
    </Animated.View>
  )
}

/** One gradient over the whole screen, with the top kept clear: the header's text sits on the canvas there. */
function Edges({ id, look }: { id: string; look: Look }) {
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

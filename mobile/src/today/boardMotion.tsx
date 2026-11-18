import { TASK_TITLES } from '@logic/taskStatus'
import type { TaskId } from '@logic/types'
import { useEffect, type ReactNode } from 'react'
import { Image, StyleSheet, type LayoutRectangle } from 'react-native'
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  interpolate,
  interpolateColor,
  LinearTransition,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { Icon } from '../components/icons/Icon'
import { useTheme } from '../theme/ThemeProvider'
import { mixHex } from '../theme/tokens'
import { TASK_ICONS } from './TaskTile'

// The web's boardMotion.ts (src/screens/Today/fills/), on the phone's UI thread.

/** A full tile shrinking into its chip. */
export const MORPH_MS = 720
/** A tile widening or narrowing when the odd one out changes. */
export const RESIZE_MS = 460
const EASE_MORPH = Easing.bezier(0.55, 0, 0.2, 1)
const EASE_SLIDE = Easing.bezier(0.2, 0.8, 0.2, 1)
const EASE_POP = Easing.bezier(0.34, 1.56, 0.64, 1)

export type Box = LayoutRectangle

/** The other tiles close up, and the odd one out widens: they slide and resize instead of jumping. Reduce motion drops it. */
export const SLIDE = LinearTransition.duration(RESIZE_MS).easing(EASE_SLIDE)
/** Reduce motion: the tile fades out where it is as its chip fades in. */
export const FADE_AWAY = FadeOut.duration(250).reduceMotion(ReduceMotion.Never)
export const FADE_HERE = FadeIn.duration(250).reduceMotion(ReduceMotion.Never)

/** A tile coming back (a task undone) grows in. */
export function growIn() {
  'worklet'
  return {
    initialValues: { opacity: 0, transform: [{ scale: 0.92 }] },
    animations: { opacity: withTiming(1, { duration: 250 }), transform: [{ scale: withTiming(1, { duration: 250 }) }] },
  }
}

/** A chip leaving (its task undone) fades and shrinks. */
export function shrinkOut() {
  'worklet'
  return {
    initialValues: { opacity: 1, transform: [{ scale: 1 }] },
    animations: { opacity: withTiming(0, { duration: 200 }), transform: [{ scale: withTiming(0.8, { duration: 200 }) }] },
  }
}

// Where things sit inside a tile and inside a chip (their own styles, in TaskTile and TaskBoard).
const TILE_ICON = { x: 20, y: 20, size: 20 }
const TILE_TITLE = { x: 12, fromBottom: 49, size: 16 }
const CHIP_ICON = { x: 13, size: 16 }
const CHIP_THUMB = 24
const CHIP_LABEL_SIZE = 14
const PHOTO = 72

interface MorphingTileProps {
  task: TaskId
  /** Where the tile stood, and its chip's place, in the board. The trip starts once the chip's place is known. */
  from: Box
  to: Box | undefined
  /** The day's photo: it gathers in the middle of the tile and shrinks into the chip's thumbnail. */
  photoUri?: string
  /** The tile as it stood: it fades in the first 30% of the trip. */
  children: ReactNode
  onLanded: () => void
}

/**
 * A full tile shrinking into its chip: its box travels to the chip's while its corners round into a pill and its
 * colour passes through the world's colour into the chip's. Its content fades, and its title and icon fly into the
 * chip's (the photo shrinks into the thumbnail). It stays where it landed, looking like the chip, until the board
 * shows the chip.
 */
export function MorphingTile({ task, from, to, photoUri, children, onLanded }: MorphingTileProps) {
  const { colors, fonts } = useTheme()
  const trip = useSharedValue(0)
  const ready = to !== undefined
  // Until the chip's place is known the tile waits where it stood.
  const end = to ?? from

  useEffect(() => {
    if (!ready) return
    trip.value = withTiming(1, { duration: MORPH_MS, easing: EASE_MORPH }, (finished) => {
      if (finished) runOnJS(onLanded)()
    })
    // Started once, when the chip's place is known; a task undone unmounts the tile, which stops it.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, trip])

  const surface = colors.surface
  const tint = mixHex(surface, colors.world, 0.55)
  const box = useAnimatedStyle(() => ({
    left: interpolate(trip.value, [0, 1], [from.x, end.x]),
    top: interpolate(trip.value, [0, 1], [from.y, end.y]),
    width: interpolate(trip.value, [0, 1], [from.width, end.width]),
    height: interpolate(trip.value, [0, 1], [from.height, end.height]),
    borderRadius: interpolate(trip.value, [0, 1], [20, end.height / 2]),
    backgroundColor: interpolateColor(trip.value, [0, 0.22, 1], [surface, tint, surface]),
  }))
  const content = useAnimatedStyle(() => ({ opacity: interpolate(trip.value, [0, 0.3], [1, 0], 'clamp') }))

  const thumb = task === 'photo' && photoUri !== undefined
  const labelX = CHIP_ICON.x + (thumb ? CHIP_THUMB : CHIP_ICON.size) + 6
  const title = useAnimatedStyle(() => ({
    color: interpolateColor(trip.value, [0, 1], [colors.ink, colors.inkMuted]),
    transform: [
      { translateX: interpolate(trip.value, [0, 1], [from.x + TILE_TITLE.x, end.x + labelX]) },
      { translateY: interpolate(trip.value, [0, 1], [from.y + from.height - TILE_TITLE.fromBottom, end.y + (end.height - 18) / 2]) },
      { scale: interpolate(trip.value, [0, 1], [1, CHIP_LABEL_SIZE / TILE_TITLE.size]) },
    ],
  }))
  const icon = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(trip.value, [0, 1], [from.x + TILE_ICON.x, end.x + CHIP_ICON.x]) },
      { translateY: interpolate(trip.value, [0, 1], [from.y + TILE_ICON.y, end.y + (end.height - CHIP_ICON.size) / 2]) },
      { scale: interpolate(trip.value, [0, 1], [1, CHIP_ICON.size / TILE_ICON.size]) },
    ],
  }))
  const photo = useAnimatedStyle(() => ({
    opacity: interpolate(trip.value, [0, 0.3], [0, 1], 'clamp'),
    transform: [
      { translateX: interpolate(trip.value, [0, 1], [from.x + from.width / 2 - PHOTO / 2, end.x + CHIP_ICON.x]) },
      { translateY: interpolate(trip.value, [0, 1], [from.y + from.height / 2 - PHOTO / 2, end.y + (end.height - CHIP_THUMB) / 2]) },
      { scale: interpolate(trip.value, [0, 1], [1, CHIP_THUMB / PHOTO]) },
    ],
  }))

  return (
    <>
      <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.box, box]}>
        {/* The tile keeps its size as its box shrinks around it: it has faded before the box is much smaller. */}
        <Animated.View style={[{ width: from.width, height: from.height }, content]}>{children}</Animated.View>
      </Animated.View>
      <Animated.Text pointerEvents="none" style={[styles.flight, styles.title, { fontFamily: fonts.rounded.bold }, title]}>
        {TASK_TITLES[task]}
      </Animated.Text>
      {thumb ? (
        <Animated.View pointerEvents="none" style={[styles.flight, styles.photo, photo]}>
          <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      ) : (
        <Animated.View pointerEvents="none" style={[styles.flight, icon]}>
          <Icon name={TASK_ICONS[task]} size={TILE_ICON.size} color={colors.inkMuted} />
        </Animated.View>
      )}
    </>
  )
}

/** Landing: the chip's tick pops and the chip gives a small bounce (the web's `popTick`). */
export function useLanding(landed: boolean) {
  const tick = useSharedValue(1)
  const turn = useSharedValue(0)
  const bounce = useSharedValue(1)
  useEffect(() => {
    if (!landed) return
    tick.value = withSequence(withTiming(0, { duration: 0 }), withTiming(1.45, { duration: 440 * 0.55, easing: EASE_POP }), withTiming(1, { duration: 440 * 0.45, easing: EASE_POP }))
    turn.value = withSequence(withTiming(-35, { duration: 0 }), withTiming(0, { duration: 440 * 0.55, easing: EASE_POP }))
    bounce.value = withSequence(withTiming(1.07, { duration: 360 * 0.35, easing: Easing.out(Easing.quad) }), withTiming(1, { duration: 360 * 0.65, easing: Easing.out(Easing.quad) }))
  }, [landed, tick, turn, bounce])
  return {
    tick: useAnimatedStyle(() => ({ transform: [{ scale: tick.value }, { rotate: `${turn.value}deg` }] })),
    chip: useAnimatedStyle(() => ({ transform: [{ scale: bounce.value }] })),
  }
}

const styles = StyleSheet.create({
  box: { position: 'absolute', zIndex: 5, overflow: 'hidden' },
  flight: { position: 'absolute', left: 0, top: 0, zIndex: 6, transformOrigin: 'left top' },
  title: { fontSize: TILE_TITLE.size, lineHeight: 20 },
  photo: { width: PHOTO, height: PHOTO, borderRadius: PHOTO / 2, overflow: 'hidden' },
})

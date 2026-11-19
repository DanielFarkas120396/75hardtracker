import { WORLD_COLORS } from '@logic/worldColors'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { useTheme } from '../theme/ThemeProvider'
import { withAlpha } from '../theme/tokens'
import { sectionFill } from './railMaths'
import { WORLDS, type World } from './worlds'

interface AltitudeRailProps {
  /** The day the rail shows, following the scroll (see dayInView): a shared value, so scrolling re-renders nothing. */
  day: SharedValue<number>
  /** Jumps to a world's chapter. */
  onJump: (world: World) => void
}

/**
 * The climb as a thin bar down the left edge, one section per world, Hell at the bottom. The fill follows the scroll:
 * it reaches the day you're looking at, climbing to today at the top of the page and sinking towards Hell as you
 * scroll back. Each section's colour rises out of the world below it. Each section is a button to its chapter. The
 * web's AltitudeRail (src/screens/Journey/AltitudeRail.tsx).
 */
export function AltitudeRail({ day, onJump }: AltitudeRailProps) {
  const insets = useSafeAreaInsets()
  return (
    <View accessibilityLabel="The climb, by world" style={[styles.rail, { top: insets.top + 96, bottom: insets.bottom + 64 }]}>
      {WORLDS.map((world, i) => (
        <Section key={world.id} world={world} below={WORLDS[Math.max(0, i - 1)]} day={day} onPress={() => onJump(world)} />
      ))}
    </View>
  )
}

function Section({ world, below, day, onPress }: { world: World; below: World; day: SharedValue<number>; onPress: () => void }) {
  const { colors, mode } = useTheme()
  const { firstDay, lastDay } = world
  const fill = useAnimatedStyle(() => ({ height: `${sectionFill(day.value, firstDay, lastDay) * 100}%` }))
  const gradient = `rise-${world.id}`
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Go to ${world.name}`}
      onPress={onPress}
      testID={`rail-${world.id}`}
      // 28 points wide: the touch reaches a little into the page, towards 48.
      hitSlop={{ left: 4, right: 12 }}
      style={[styles.section, { flexGrow: lastDay - firstDay + 1 }]}
    >
      <View style={[styles.track, { backgroundColor: withAlpha(colors.ink, 0.15) }]}>
        <Animated.View style={[styles.fill, fill]}>
          <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none">
            <Defs>
              <LinearGradient id={gradient} x1="0" y1="1" x2="0" y2="0">
                <Stop offset="0" stopColor={WORLD_COLORS[below.id][mode].world} />
                <Stop offset="0.7" stopColor={WORLD_COLORS[world.id][mode].world} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill={`url(#${gradient})`} />
          </Svg>
        </Animated.View>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  rail: { position: 'absolute', left: 4, width: 28, flexDirection: 'column-reverse', gap: 4 },
  section: { flexBasis: 0, alignItems: 'center' },
  track: { width: 4, height: '100%', overflow: 'hidden', borderRadius: 2 },
  fill: { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden', borderRadius: 2 },
})

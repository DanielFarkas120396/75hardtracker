import { useMemo, useState } from 'react'
import { PanResponder, StyleSheet, View, type GestureResponderEvent } from 'react-native'
import { useTheme } from '../../theme/ThemeProvider'
import { withAlpha } from '../../theme/tokens'

interface RangeSliderProps {
  value: number
  min: number
  max: number
  /** Called with whole numbers between min and max, as the finger moves. */
  onChange: (value: number) => void
  /** What VoiceOver calls it ("Day", "Speed"). */
  label: string
  /** What VoiceOver says for the value ("Day 12", "0.40 seconds per photo"). */
  valueText: string
  /** How far one VoiceOver swipe moves it. */
  step?: number
}

const THUMB = 24

/**
 * A slider on a track in the world's colour: the web's `<input type="range">` with `accent-world`. Drag or tap along
 * it; VoiceOver adjusts it with a swipe up or down. 48 points tall, for a finger.
 */
export function RangeSlider({ value, min, max, onChange, label, valueText, step = 1 }: RangeSliderProps) {
  const { colors } = useTheme()
  const [width, setWidth] = useState(0)
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v)))
  const share = max > min ? (value - min) / (max - min) : 0

  const handle = useMemo(() => {
    const follow = (event: GestureResponderEvent) => {
      if (width > THUMB) onChange(clamp(min + ((event.nativeEvent.locationX - THUMB / 2) / (width - THUMB)) * (max - min)))
    }
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // A horizontal drag stays with the slider, even inside a scrolling page.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: follow,
      onPanResponderMove: follow,
    })
    // clamp only reads min and max.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [width, min, max, onChange])

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: valueText }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => onChange(clamp(value + (event.nativeEvent.actionName === 'increment' ? step : -step)))}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={styles.slider}
      {...handle.panHandlers}
    >
      <View pointerEvents="none" style={[styles.track, { backgroundColor: withAlpha('#ffffff', 0.25) }]}>
        <View style={[styles.filled, { width: `${share * 100}%`, backgroundColor: colors.world }]} />
      </View>
      <View pointerEvents="none" style={[styles.thumb, { left: share * Math.max(0, width - THUMB), backgroundColor: colors.world }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  slider: { flex: 1, height: 48, justifyContent: 'center' },
  track: { height: 4, borderRadius: 2, marginHorizontal: THUMB / 2, overflow: 'hidden' },
  filled: { height: '100%' },
  thumb: { position: 'absolute', width: THUMB, height: THUMB, borderRadius: THUMB / 2, top: (48 - THUMB) / 2 },
})

import { isCheckmark, typedStroke, type Point } from '@logic/checkmark'
import { useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native'
import Svg, { Path, Polyline } from 'react-native-svg'
import { useTheme } from '../../theme/ThemeProvider'
import { withAlpha } from '../../theme/tokens'

interface DrawCheckPadProps {
  /** Runs when the stroke on the pad becomes, or stops being, a checkmark. */
  onChange: (checked: boolean) => void
  disabled?: boolean
  /** What to draw: it names the pad for VoiceOver. */
  label: string
}

/** The pad's size until it has been laid out: VoiceOver's checkmark is drawn into it. */
const FALLBACK_SIZE = { width: 320, height: 192 }

/**
 * A blank pad to sign on: one finger stroke, which counts once it reads as a
 * checkmark (src/logic/checkmark.ts, as on the web). A stroke that doesn't
 * stays on the pad, with a word under it; the next stroke replaces it, and ×
 * clears it. VoiceOver's "activate" draws the checkmark, so nobody is locked out.
 */
export function DrawCheckPad({ onChange, disabled = false, label }: DrawCheckPadProps) {
  const { colors, fonts } = useTheme()
  const [points, setPoints] = useState<Point[]>([])
  const [status, setStatus] = useState<'blank' | 'drawing' | 'checked' | 'missed'>('blank')
  // The stroke being drawn, as a ref: React may not have rendered the last moves when the finger lifts.
  const stroke = useRef<Point[]>([])
  const size = useRef(FALLBACK_SIZE)

  const settle = (drawn: Point[]) => {
    stroke.current = drawn
    setPoints(drawn)
    const checked = isCheckmark(drawn)
    setStatus(checked ? 'checked' : 'missed')
    onChange(checked)
  }

  const clear = () => {
    stroke.current = []
    setPoints([])
    setStatus('blank')
    onChange(false)
  }

  const at = (event: GestureResponderEvent): Point => ({ x: event.nativeEvent.locationX, y: event.nativeEvent.locationY })

  const line = status === 'missed' ? 'Not quite a checkmark. Try again.' : status === 'checked' ? 'Signed.' : ''

  return (
    <View>
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Double tap to sign."
        accessibilityState={{ disabled }}
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={(event) => {
          if (!disabled && event.nativeEvent.actionName === 'activate') settle(typedStroke(size.current.width, size.current.height))
        }}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout
          if (width > 0 && height > 0) size.current = { width, height }
        }}
        // The pad takes the touch and keeps it: a scroll view above must not steal the stroke.
        onStartShouldSetResponder={() => !disabled}
        onMoveShouldSetResponder={() => !disabled}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(event) => {
          stroke.current = [at(event)]
          setPoints(stroke.current)
          setStatus('drawing')
          onChange(false)
        }}
        onResponderMove={(event) => {
          stroke.current = [...stroke.current, at(event)]
          setPoints(stroke.current)
        }}
        onResponderRelease={(event) => settle([...stroke.current, at(event)])}
        onResponderTerminate={(event) => settle([...stroke.current, at(event)])}
        style={[styles.pad, { borderColor: withAlpha(colors.ink, 0.15), backgroundColor: colors.surface }]}
      >
        {/* The drawing takes no touches itself, so every point is measured from the pad's corner. */}
        <Svg pointerEvents="none" width="100%" height="100%">
          <Polyline
            points={points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')}
            fill="none"
            stroke={colors.ink}
            strokeWidth={6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
        {points.length > 0 && (
          <Pressable accessibilityRole="button" accessibilityLabel="Clear the drawing" onPress={clear} style={styles.clear}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.inkMuted} strokeWidth={2} strokeLinecap="round">
              <Path d="M6 6l12 12M18 6L6 18" />
            </Svg>
          </Pressable>
        )}
      </View>
      <Text accessibilityLiveRegion="polite" style={[styles.line, { color: colors.inkMuted, fontFamily: fonts.rounded.regular }]}>
        {line}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  pad: { height: 192, alignSelf: 'stretch', overflow: 'hidden', borderRadius: 20, borderWidth: 1 },
  clear: { position: 'absolute', left: 8, bottom: 8, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  line: { marginTop: 8, minHeight: 20, fontSize: 14, textAlign: 'center' },
})

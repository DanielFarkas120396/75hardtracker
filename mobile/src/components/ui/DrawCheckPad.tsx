import { isCheckmark, typedStroke, type Point } from '@logic/checkmark'
import { useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native'
import Svg, { Path, Polyline } from 'react-native-svg'
import { useAnnounceChanges } from '../../hooks/useAnnounce'
import { useTheme } from '../../theme/ThemeProvider'
import { withAlpha } from '../../theme/tokens'

interface DrawCheckPadProps {
  /** Runs when the stroke on the pad becomes, or stops being, a checkmark. */
  onChange: (checked: boolean) => void
  /** Runs when a stroke starts (true) and ends (false): the page under the pad must not scroll meanwhile. */
  onDrawingChange?: (drawing: boolean) => void
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
 * clears it. VoiceOver's double tap draws the checkmark, so nobody is locked out.
 *
 * A scroll view above the pad scrolls under the finger whatever the pad
 * answers (it only yields to a responder that contains it), so the pad says
 * when a stroke is on (`onDrawingChange`) and the page stops scrolling.
 */
export function DrawCheckPad({ onChange, onDrawingChange, disabled = false, label }: DrawCheckPadProps) {
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
  const lift = (event: GestureResponderEvent) => {
    onDrawingChange?.(false)
    settle([...stroke.current, at(event)])
  }
  const typed = () => {
    if (!disabled) settle(typedStroke(size.current.width, size.current.height))
  }

  const line = status === 'missed' ? 'Not quite a checkmark. Try again.' : status === 'checked' ? 'Signed.' : ''
  useAnnounceChanges(line)

  return (
    <View>
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Double tap to sign."
        accessibilityState={{ disabled }}
        // VoiceOver's double tap. On the iPhone it arrives as a tap, never as the "activate" action.
        onAccessibilityTap={typed}
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'activate') typed()
        }}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout
          if (width > 0 && height > 0) size.current = { width, height }
        }}
        // Only a touch that starts on the pad draws: one that started on the × stays the ×'s.
        onStartShouldSetResponder={() => !disabled}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(event) => {
          onDrawingChange?.(true)
          stroke.current = [at(event)]
          setPoints(stroke.current)
          setStatus('drawing')
          onChange(false)
        }}
        onResponderMove={(event) => {
          stroke.current = [...stroke.current, at(event)]
          setPoints(stroke.current)
        }}
        onResponderRelease={lift}
        onResponderTerminate={lift}
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
      </View>
      {/* Beside the pad, not inside it: VoiceOver can't reach inside a view it reads as one button. */}
      {points.length > 0 && (
        <Pressable accessibilityRole="button" accessibilityLabel="Clear the drawing" onPress={clear} style={styles.clear}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.inkMuted} strokeWidth={2} strokeLinecap="round">
            <Path d="M6 6l12 12M18 6L6 18" />
          </Svg>
        </Pressable>
      )}
      <Text style={[styles.line, { color: colors.inkMuted, fontFamily: fonts.rounded.regular }]}>
        {line}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  pad: { height: 192, alignSelf: 'stretch', overflow: 'hidden', borderRadius: 20, borderWidth: 1 },
  // Over the pad's bottom-left corner: the pad is 192 high, the button 48, with 8 of margin.
  clear: { position: 'absolute', left: 8, top: 192 - 48 - 8, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  line: { marginTop: 8, minHeight: 20, fontSize: 14, textAlign: 'center' },
})

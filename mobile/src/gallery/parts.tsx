import { useEffect, useState, type ReactNode } from 'react'
import { Animated, Modal, Pressable, StyleSheet, Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Icon } from '../components/icons/Icon'
import { useTheme } from '../theme/ThemeProvider'

// What the lightbox and Compare share: the one full-screen overlay they open in, and their white-on-black buttons.

/**
 * The Gallery's one Modal: a black view that fades in over everything, keeps what it showed while it fades out, and
 * holds the lightbox or Compare (never two Modals). VoiceOver's escape closes it.
 */
export function Overlay({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const shown = useState(() => new Animated.Value(0))[0]
  const [mounted, setMounted] = useState(open)
  const [kept, setKept] = useState(children)
  if (open && !mounted) setMounted(true)
  if (open && kept !== children) setKept(children)

  useEffect(() => {
    const fade = Animated.timing(shown, { toValue: open ? 1 : 0, duration: 200, useNativeDriver: true })
    fade.start(({ finished }) => {
      if (finished && !open) setMounted(false)
    })
    return () => fade.stop()
  }, [open, shown])

  return (
    <Modal visible={mounted} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View
        accessibilityViewIsModal
        onAccessibilityEscape={onClose}
        // On its way out it takes no touch: a late tap must not act twice.
        pointerEvents={open ? 'auto' : 'none'}
        style={[styles.fill, { opacity: shown }]}
      >
        {open ? children : kept}
      </Animated.View>
    </Modal>
  )
}

/** A rounded white-on-black button: Older, Newer, Slider, Time-lapse, Replay. `selected` fills it in the world's colour. */
export function PillButton({ label, onPress, disabled = false, selected }: { label: string; onPress: () => void; disabled?: boolean; selected?: boolean }) {
  const { colors, fonts } = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.pill, { backgroundColor: selected ? colors.world : 'rgba(255, 255, 255, 0.1)', opacity: disabled ? 0.3 : 1 }]}
    >
      <Text style={[styles.pillText, { color: selected ? colors.onWorld : '#ffffff', fontFamily: fonts.rounded.bold }]}>{label}</Text>
    </Pressable>
  )
}

/** ✕ in the top right corner, under the status bar. */
export function CloseButton({ onPress }: { onPress: () => void }) {
  const insets = useSafeAreaInsets()
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onPress} style={[styles.close, { top: Math.max(16, insets.top) }]}>
      <Icon name="close" color="#ffffff" />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  pill: { minHeight: 48, minWidth: 48, justifyContent: 'center', borderRadius: 999, paddingHorizontal: 16 },
  pillText: { fontSize: 16 },
  close: { position: 'absolute', right: 16, width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: 'rgba(255, 255, 255, 0.1)' },
})

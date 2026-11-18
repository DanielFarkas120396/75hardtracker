import { useEffect, useState, type ReactNode } from 'react'
import { Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { useTheme } from '../../theme/ThemeProvider'
import { Icon } from '../icons/Icon'
import type { IconName } from '../icons/icons'

interface SheetProps {
  open: boolean
  onClose: () => void
  /** What the sheet is, for VoiceOver. */
  label: string
  children: ReactNode
}

/**
 * A sheet anchored to the bottom edge that slides up over a dimmed page: the
 * web's Modal with placement "sheet" (src/components/ui/Modal.tsx). It closes
 * on a tap beside it, scrolls when taller than its room (85% of the screen),
 * and rides up with the keyboard. While it slides away it keeps showing what
 * it held. Reduce motion drops the slide and keeps the fade.
 */
export function Sheet({ open, onClose, label, children }: SheetProps) {
  const { colors } = useTheme()
  const reduceMotion = useReduceMotion()
  const { height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const shown = useState(() => new Animated.Value(0))[0]
  // Mounted from the moment it opens until it has slid away.
  const [mounted, setMounted] = useState(open)
  // What it held when it was last open: the slide out has something to show.
  const [kept, setKept] = useState(children)
  if (open && !mounted) setMounted(true)
  if (open && kept !== children) setKept(children)

  useEffect(() => {
    if (open) {
      const opening = reduceMotion
        ? Animated.timing(shown, { toValue: 1, duration: 150, useNativeDriver: true })
        : Animated.spring(shown, { toValue: 1, stiffness: 300, damping: 28, mass: 1, useNativeDriver: true })
      opening.start()
      return () => opening.stop()
    }
    const closing = Animated.timing(shown, { toValue: 0, duration: 200, useNativeDriver: true })
    closing.start(({ finished }) => {
      if (finished) setMounted(false)
    })
    return () => closing.stop()
  }, [open, shown, reduceMotion])

  const slide = reduceMotion ? 0 : shown.interpolate({ inputRange: [0, 1], outputRange: [height, 0] })

  return (
    <Modal visible={mounted} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.dim, { opacity: shown }]}>
          {/* VoiceOver stays inside the sheet, which has its own Close: the dimmed page is for a finger. */}
          <Pressable testID="sheet-backdrop" accessible={false} onPress={onClose} style={styles.fill} />
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          accessibilityLabel={label}
          style={[
            styles.panel,
            { maxHeight: height * 0.85, backgroundColor: colors.surface, opacity: reduceMotion ? shown : 1, transform: [{ translateY: slide }] },
          ]}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.content, { paddingBottom: Math.max(20, insets.bottom) }]}
          >
            {open ? children : kept}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

interface SheetHeaderProps {
  icon: IconName
  title: string
  ruleLine?: string
  /** Beside the title, before Close (the done badge). */
  badge?: ReactNode
  onClose: () => void
  children?: ReactNode
}

/** A sheet's header: the world's tint, the icon, the title and a close button. It reaches the sheet's edges. */
export function SheetHeader({ icon, title, ruleLine, badge, onClose, children }: SheetHeaderProps) {
  const { colors, fonts } = useTheme()
  return (
    <View style={[styles.header, { backgroundColor: colors.worldSoft }]}>
      <View style={[styles.well, { backgroundColor: colors.surface }]}>
        <Icon name={icon} color={colors.worldInk} />
      </View>
      <View style={styles.titles}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.ink, fontFamily: fonts.rounded.bold }]}>
          {title}
        </Text>
        {ruleLine !== undefined && <Text style={[styles.rule, { color: colors.worldInk, fontFamily: fonts.rounded.semibold }]}>{ruleLine}</Text>}
      </View>
      {badge !== undefined && <View style={styles.badge}>{badge}</View>}
      <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.close}>
        <Icon name="close" size={20} color={colors.inkMuted} />
      </Pressable>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  dim: { backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  panel: { borderTopLeftRadius: 40, borderTopRightRadius: 40, overflow: 'hidden' },
  content: { padding: 20 },
  header: { margin: -20, marginBottom: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 20, paddingBottom: 16 },
  well: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  titles: { flex: 1, minWidth: 0 },
  title: { fontSize: 20 },
  rule: { marginTop: 2, fontSize: 14, lineHeight: 19 },
  badge: { marginTop: 8 },
  close: { width: 48, height: 48, marginTop: -6, marginRight: -10, alignItems: 'center', justifyContent: 'center', borderRadius: 24 },
})

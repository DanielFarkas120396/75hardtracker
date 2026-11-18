import type { ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Icon } from '../components/icons/Icon'
import type { IconName } from '../components/icons/icons'
import { gaze } from '../components/mascot/gaze'
import { useTheme } from '../theme/ThemeProvider'
import { withAlpha } from '../theme/tokens'
import { CAMERA_SHEET_SHARE } from './CameraSheet'
import { usePhotoCapture } from './photoCaptureContext'

// What Today's screens share: the scrolling page, the buttons under a board, the centred line.

interface PageProps {
  /** Behind everything, and still while the page scrolls (the evening's mood lighting). */
  behind?: ReactNode
  children: ReactNode
}

/**
 * The scrolling page under the status bar. While the camera is open it gains
 * room at the bottom, so everything can still be scrolled up above the sheet.
 * It tells the ducks where fingers are, and when it scrolls. Lives under a PhotoCapture.
 */
export function Page({ behind, children }: PageProps) {
  const { colors } = useTheme()
  const { height } = useWindowDimensions()
  const { cameraOpen } = usePhotoCapture()
  return (
    <SafeAreaView
      testID="today-page"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.canvas }]}
      onTouchStart={(event) => gaze.touch(event.nativeEvent.pageX, event.nativeEvent.pageY)}
      onTouchMove={(event) => gaze.touch(event.nativeEvent.pageX, event.nativeEvent.pageY)}
    >
      {behind}
      <ScrollView
        testID="today-scroll"
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={100}
        onScroll={() => gaze.scrolled()}
        contentContainerStyle={{ paddingBottom: 96 + (cameraOpen ? height * CAMERA_SHEET_SHARE : 0) }}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  )
}

interface ActionButtonProps {
  icon: IconName
  label: string
  /** What VoiceOver says, when the label alone is too short ("Social night" → "Plan a social night"). */
  accessibilityLabel?: string
  disabled?: boolean
  onPress: () => void
}

/** A labelled button under the board, in thumb reach: the evening plan, the social night, the notes. Each stays on one line. */
export function ActionButton({ icon, label, accessibilityLabel, disabled = false, onPress }: ActionButtonProps) {
  const { colors, fonts, mode } = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.action, { backgroundColor: colors.surface, borderColor: mode === 'light' ? withAlpha(colors.ink, 0.1) : 'transparent' }]}
    >
      <Icon name={icon} size={18} color={disabled ? colors.inkMuted : colors.worldInk} />
      <Text numberOfLines={1} style={[styles.label, { color: disabled ? colors.inkMuted : colors.ink, fontFamily: fonts.rounded.bold }]}>
        {label}
      </Text>
    </Pressable>
  )
}

/** One line in the middle of an empty screen ("Loading…"). */
export function Centred({ children }: { children: string }) {
  const { colors, fonts } = useTheme()
  return (
    <View style={[styles.screen, styles.centred, { backgroundColor: colors.canvas }]}>
      <Text style={[styles.line, { color: colors.inkMuted, fontFamily: fonts.rounded.regular }]}>{children}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centred: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  line: { fontSize: 16 },
  action: { flexGrow: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 24, borderWidth: 1, paddingHorizontal: 12 },
  label: { fontSize: 14 },
})

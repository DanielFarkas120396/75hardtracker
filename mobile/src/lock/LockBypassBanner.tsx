import { format } from 'date-fns'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { appLockRepo } from '../db/repositories/appLockRepo'
import { useLiveQuery } from '../db/useLiveQuery'
import { useTheme } from '../theme/ThemeProvider'
import { withAlpha } from '../theme/tokens'

/** The tripwire: the app lock was turned off through "Can't unlock?". Shown on Today until dismissed. The web's LockBypassBanner. */
export function LockBypassBanner() {
  const { colors, fonts } = useTheme()
  const bypassedAt = useLiveQuery(() => appLockRepo.getBypassedAt(), [])
  if (!bypassedAt) return null
  return (
    <View accessible={false} style={[styles.banner, { backgroundColor: withAlpha(colors.danger, 0.1), borderColor: withAlpha(colors.danger, 0.3) }]}>
      <Text style={[styles.title, { color: colors.ink, fontFamily: fonts.rounded.bold }]}>
        🔓 The app lock was turned off on {format(new Date(bypassedAt), 'MMM d, HH:mm')} with “Can&apos;t unlock?”.
      </Text>
      <Text style={[styles.body, { color: colors.inkMuted, fontFamily: fonts.rounded.regular }]}>Wasn&apos;t you? Turn it back on in Settings → App lock.</Text>
      <Pressable accessibilityRole="button" onPress={() => void appLockRepo.dismissBypassNotice()} style={[styles.button, { backgroundColor: colors.surface }]}>
        <Text style={[styles.buttonText, { color: colors.ink, fontFamily: fonts.rounded.bold }]}>Got it</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: { marginHorizontal: 16, marginBottom: 16, borderRadius: 24, borderWidth: 1, padding: 16 },
  title: { fontSize: 14, lineHeight: 20 },
  body: { marginTop: 4, fontSize: 14, lineHeight: 20 },
  button: { minHeight: 48, alignSelf: 'flex-start', justifyContent: 'center', marginTop: 8, borderRadius: 16, paddingHorizontal: 16 },
  buttonText: { fontSize: 14 },
})

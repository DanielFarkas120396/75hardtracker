import { StyleSheet, Text, View } from 'react-native'
import { BASE_COLORS } from '../theme/tokens'

// Shown when the database can't be opened, so before any theme or font is available:
// the dark Ember colours, in the system font.
const colors = { ...BASE_COLORS.dark, canvas: '#16110e' }

export function DatabaseError({ message }: { message: string }) {
  return (
    <View style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>
        Your data couldn&apos;t be opened.
      </Text>
      <Text style={styles.text}>Close the app and open it again. If this keeps happening, send us this message:</Text>
      <Text selectable style={styles.message}>
        {message}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', gap: 12, padding: 28, backgroundColor: colors.canvas },
  title: { color: colors.ink, fontSize: 24, fontWeight: '700' },
  text: { color: colors.inkMuted, fontSize: 17, lineHeight: 24 },
  message: { color: colors.dangerInk, fontSize: 15 },
})

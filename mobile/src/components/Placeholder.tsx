import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTheme } from '../theme/ThemeProvider'

/** A screen that isn't built yet: its title in the Ember look, and whatever it can already show. */
export function Placeholder({ title, children }: { title: string; children?: ReactNode }) {
  const { colors, fonts } = useTheme()
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.canvas }]}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.ink, fontFamily: fonts.display.bold }]}>
        {title}
      </Text>
      <View style={styles.body}>{children}</View>
    </SafeAreaView>
  )
}

/** A line of body text on a placeholder screen. */
export function PlaceholderText({ children }: { children: ReactNode }) {
  const { colors, fonts } = useTheme()
  return <Text style={[styles.text, { color: colors.inkMuted, fontFamily: fonts.rounded.medium }]}>{children}</Text>
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 20 },
  title: { fontSize: 34, marginTop: 12 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  text: { fontSize: 17 },
})

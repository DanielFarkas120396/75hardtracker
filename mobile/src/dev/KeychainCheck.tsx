import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { getItem, removeItem, setItem } from '../../modules/synced-keychain'
import { useTheme } from '../theme/ThemeProvider'

const KEY = 'keychain-check'

/**
 * Developer tool for the two-device check: write a value on one iPhone, read it
 * on another with the same Apple ID. Shows the stored value, or what went wrong.
 */
export function KeychainCheck() {
  const { colors, fonts } = useTheme()
  const [shown, setShown] = useState('…')

  const run = (action: () => Promise<void>) => {
    action()
      .then(() => getItem(KEY))
      .then(
        (value) => setShown(value ?? 'No value'),
        (error: unknown) => setShown(error instanceof Error ? error.message : String(error)),
      )
  }

  useEffect(() => run(async () => {}), [])

  const button = (label: string, action: () => Promise<void>) => (
    <Pressable
      accessibilityRole="button"
      onPress={() => run(action)}
      style={[styles.button, { borderColor: colors.worldInk }]}
    >
      <Text style={[styles.label, { color: colors.worldInk, fontFamily: fonts.rounded.semibold }]}>{label}</Text>
    </Pressable>
  )

  return (
    <View style={styles.panel}>
      <Text style={[styles.heading, { color: colors.inkMuted, fontFamily: fonts.rounded.semibold }]}>
        Synced keychain
      </Text>
      <Text selectable style={[styles.value, { color: colors.ink, fontFamily: fonts.rounded.medium }]}>
        {shown}
      </Text>
      <View style={styles.row}>
        {button('Write the time', () => setItem(KEY, new Date().toISOString()))}
        {button('Read', async () => {})}
        {button('Remove', () => removeItem(KEY))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  panel: { alignItems: 'center', gap: 10 },
  heading: { fontSize: 15 },
  value: { fontSize: 17, textAlign: 'center' },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  button: { minHeight: 44, justifyContent: 'center', borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 14 },
  label: { fontSize: 16 },
})

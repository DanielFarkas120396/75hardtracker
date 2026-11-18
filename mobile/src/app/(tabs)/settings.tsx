import { Alert, Pressable, StyleSheet, Text } from 'react-native'
import { ImportBackup } from '../../backup/ImportBackupFlow'
import { Placeholder, PlaceholderText } from '../../components/Placeholder'
import { KeychainCheck } from '../../dev/KeychainCheck'
import { seedDay } from '../../dev/seed'
import { useTheme } from '../../theme/ThemeProvider'

function confirmSeed() {
  Alert.alert('Erase everything?', 'This replaces all data on this phone with a test attempt.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Erase', style: 'destructive', onPress: () => void seedDay(12) },
  ])
}

export default function SettingsScreen() {
  const { colors, fonts } = useTheme()
  return (
    <Placeholder title="Settings">
      <PlaceholderText>Coming soon</PlaceholderText>
      <ImportBackup />
      {__DEV__ && (
        <Pressable
          accessibilityRole="button"
          onPress={confirmSeed}
          style={[styles.button, { backgroundColor: colors.world }]}
        >
          <Text style={[styles.label, { color: colors.onWorld, fontFamily: fonts.rounded.bold }]}>Seed Day 12</Text>
        </Pressable>
      )}
      {__DEV__ && <KeychainCheck />}
    </Placeholder>
  )
}

const styles = StyleSheet.create({
  button: { minHeight: 48, justifyContent: 'center', borderRadius: 14, paddingHorizontal: 22 },
  label: { fontSize: 17 },
})

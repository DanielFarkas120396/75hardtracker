import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Mascot } from '../components/mascot/Mascot'
import { Button } from '../components/ui/Button'
import { isFaceIdAvailable } from '../lock/faceId'
import { NewPinFlow } from '../lock/PinPad'
import { useLockSetup } from '../lock/useLockSetup'
import { useTheme } from '../theme/ThemeProvider'
import { Alert, DuckGlow, StepTitle } from './parts'

type Stage = 'question' | 'pin' | 'faceId'

const FACE_ID_FAILED_LINE = "Face ID didn't confirm. Try again, or skip it for now."

/**
 * Right after the deal is signed, once: the app lock as an optional screen. A PIN first (the lock's base), then Face
 * ID where the phone has it. The app opens unlocked: AppLock doesn't lock a lock turned on mid-session. The web's
 * LockOffer.
 */
export function LockOffer({ onDone }: { onDone: () => void }) {
  const { colors, fonts } = useTheme()
  const [stage, setStage] = useState<Stage>('question')
  const { busy, error, clearError, turnOn, addFaceId } = useLockSetup({ faceIdFailedLine: FACE_ID_FAILED_LINE })
  // A new key restarts the pad after a failed save.
  const [padKey, setPadKey] = useState(0)

  const savePin = async (pin: string) => {
    if (busy) return
    if (!(await turnOn(pin))) {
      setPadKey((key) => key + 1)
      return
    }
    if (await isFaceIdAvailable()) setStage('faceId')
    else onDone()
  }

  const link = (label: string, onPress: () => void) => (
    <Pressable accessibilityRole="button" disabled={busy} onPress={onPress} style={styles.link}>
      <Text style={[styles.linkText, { color: colors.inkMuted, fontFamily: fonts.rounded.semibold }]}>{label}</Text>
    </Pressable>
  )

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.canvas }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View>
          <DuckGlow />
          <Mascot mood="content" size={stage === 'pin' ? 64 : 96} />
        </View>

        {stage === 'question' && (
          <>
            <StepTitle>Keep it private?</StepTitle>
            <Text style={[styles.lead, { color: colors.inkMuted, fontFamily: fonts.rounded.regular }]}>
              Your photos, weight and notes stay on this phone. A PIN keeps them hidden from anyone holding it.
            </Text>
            <Button label="Set a PIN" onPress={() => setStage('pin')} style={styles.primary} />
            {link('Not now', onDone)}
            <Text style={[styles.note, { color: colors.inkMuted, fontFamily: fonts.rounded.regular }]}>You can turn it on later in Settings → Privacy &amp; data.</Text>
          </>
        )}

        {stage === 'pin' && (
          <View style={styles.full}>
            <NewPinFlow key={padKey} onDone={(pin) => void savePin(pin)} />
            {busy && <Text style={[styles.note, { color: colors.inkMuted, fontFamily: fonts.rounded.regular }]}>Saving…</Text>}
            {error !== null && <Alert>{error}</Alert>}
            <Button
              variant="secondary"
              label="Cancel"
              disabled={busy}
              onPress={() => {
                clearError()
                setStage('question')
              }}
              style={styles.cancel}
            />
          </View>
        )}

        {stage === 'faceId' && (
          <>
            <StepTitle>Also unlock with Face ID?</StepTitle>
            {error !== null && <Alert>{error}</Alert>}
            <Button
              label="Turn on Face ID"
              disabled={busy}
              onPress={() => void addFaceId().then((ok) => ok && onDone())}
              style={styles.primary}
            />
            {link('Not now', onDone)}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingTop: 72, paddingBottom: 24 },
  lead: { marginTop: 4, fontSize: 16, lineHeight: 23, textAlign: 'center' },
  primary: { marginTop: 24, alignSelf: 'stretch' },
  link: { minHeight: 48, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  linkText: { fontSize: 16 },
  note: { marginTop: 8, fontSize: 14, textAlign: 'center' },
  full: { alignSelf: 'stretch', marginTop: 8 },
  cancel: { marginTop: 16 },
})

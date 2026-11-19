import { formatCountdown, wrongPinLine, type PinFailures } from '@logic/appLock'
import Constants from 'expo-constants'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Icon } from '../components/icons/Icon'
import { Mascot } from '../components/mascot/Mascot'
import { Button } from '../components/ui/Button'
import type { PinResult } from '../db/repositories/appLockRepo'
import { useTheme } from '../theme/ThemeProvider'
import { NewPinFlow, PinPad, useCountdown } from './PinPad'

interface LockScreenProps {
  faceIdEnabled: boolean
  failures: PinFailures
  onFaceId: () => Promise<boolean>
  onPin: (pin: string) => Promise<PinResult>
  /** Face ID without opening, for "Forgot PIN?". */
  onConfirmFaceId: () => Promise<boolean>
  onResetPin: (pin: string) => Promise<void>
  /** "Can't unlock?": turns the lock off (leaving a notice) and opens the app. */
  onBypass: () => Promise<void>
}

/** The app's name as the phone shows it ("Companion" until the owner picks one): no "75 Hard" in the native app. */
const APP_NAME = Constants.expoConfig?.name ?? 'The app'

/**
 * Covers the whole app while the lock is closed, like a banking app: Face ID first (asked once on its own), the PIN
 * pad as the backup. Wrong PINs cost growing waits; "Forgot PIN?" sets a new one after Face ID. "Turn the lock off?"
 * asks in place: no Modal shows above the lock. The web's LockScreen.
 */
export function LockScreen({ faceIdEnabled, failures, onFaceId, onPin, onConfirmFaceId, onResetPin, onBypass }: LockScreenProps) {
  const { colors, fonts } = useTheme()
  const insets = useSafeAreaInsets()
  const [mode, setMode] = useState<'pin' | 'newPin' | 'bypass'>('pin')
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const secondsLeft = useCountdown(failures.lockedUntil)
  const waiting = secondsLeft > 0

  // Face ID straight away, only once.
  const asked = useRef(false)
  const onOpen = useEffectEvent(() => {
    if (asked.current || !faceIdEnabled) return
    asked.current = true
    void onFaceId()
  })
  useEffect(() => onOpen(), [])

  const submitPin = async (pin: string) => {
    setChecking(true)
    const result = await onPin(pin)
    setChecking(false)
    if (!result.ok) setError(wrongPinLine(result.failures.count))
  }

  const forgotPin = async () => {
    setError(null)
    if (await onConfirmFaceId()) setMode('newPin')
    else setError("Face ID didn't confirm. Try again, or use your PIN.")
  }

  return (
    <View accessibilityViewIsModal style={[StyleSheet.absoluteFill, { backgroundColor: colors.canvas }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}>
        <Mascot mood="watching" size={80} decorative />
        <Text accessibilityRole="header" style={[styles.title, { color: colors.ink, fontFamily: fonts.display.semibold }]}>
          {APP_NAME} is locked
        </Text>

        {mode === 'bypass' ? (
          <View style={styles.bypass}>
            <Text accessibilityRole="header" style={[styles.question, { color: colors.ink, fontFamily: fonts.rounded.bold }]}>
              Turn the lock off?
            </Text>
            <Text style={[styles.body, { color: colors.inkMuted, fontFamily: fonts.rounded.regular }]}>
              This opens the app and turns the lock off. Next time, the app will show that it was turned off this way, so its owner knows.
            </Text>
            <View style={styles.buttons}>
              <Button variant="danger" label="Turn off and open" style={styles.flex} onPress={() => void onBypass()} />
              <Button variant="secondary" label="Cancel" style={styles.flex} onPress={() => setMode('pin')} />
            </View>
          </View>
        ) : mode === 'newPin' ? (
          <NewPinFlow title="Choose a new PIN" faceId={faceIdEnabled} onDone={(pin) => void onResetPin(pin)} />
        ) : (
          <PinPad
            title="Enter your PIN"
            disabled={waiting || checking}
            error={waiting ? null : error}
            hint={waiting ? `Too many wrong PINs. Try again in ${formatCountdown(secondsLeft)}.` : checking ? 'Checking…' : null}
            onComplete={(pin) => void submitPin(pin)}
            extraKey={
              faceIdEnabled ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Unlock with Face ID" onPress={() => void onFaceId()} style={styles.faceKey}>
                  <Icon name="profile" size={30} color={colors.worldInk} />
                </Pressable>
              ) : null
            }
          />
        )}

        {mode === 'pin' && (
          <View style={styles.links}>
            {faceIdEnabled && (
              <Pressable accessibilityRole="button" onPress={() => void forgotPin()} style={styles.link}>
                <Text style={[styles.linkText, { color: colors.worldInk, fontFamily: fonts.rounded.bold }]}>Forgot PIN?</Text>
              </Pressable>
            )}
            <Pressable accessibilityRole="button" onPress={() => setMode('bypass')} style={styles.link}>
              <Text style={[styles.smallLink, { color: colors.inkMuted, fontFamily: fonts.rounded.bold }]}>Can&apos;t unlock?</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 24 },
  title: { fontSize: 26, textAlign: 'center' },
  bypass: { width: '100%', maxWidth: 360, marginTop: 8 },
  question: { fontSize: 18, textAlign: 'center' },
  body: { marginTop: 8, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  buttons: { marginTop: 16, flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  faceKey: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', borderRadius: 32 },
  links: { marginTop: 8, alignItems: 'center' },
  link: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12 },
  linkText: { fontSize: 14 },
  smallLink: { fontSize: 12, textDecorationLine: 'underline' },
})

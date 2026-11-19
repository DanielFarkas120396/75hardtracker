import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Button } from '../components/ui/Button'
import { Toggle } from '../components/ui/controls'
import { Sheet } from '../components/ui/Sheet'
import { appLockRepo } from '../db/repositories/appLockRepo'
import { useLiveQuery } from '../db/useLiveQuery'
import { isFaceIdAvailable } from '../lock/faceId'
import { CheckPinPad, NewPinFlow } from '../lock/PinPad'
import { useLockSetup } from '../lock/useLockSetup'
import { useTheme } from '../theme/ThemeProvider'
import { Card, Muted, StatusLine, settingsStyles } from './rows'

type Dialog = 'setup' | 'choosePin' | 'changeCheck' | 'changeNew' | 'offCheck'

const DIALOG_LABELS: Record<Dialog, string> = {
  setup: 'Turn on the app lock',
  choosePin: 'Choose a PIN',
  changeCheck: 'Change PIN',
  changeNew: 'Change PIN',
  offCheck: 'Turn off the app lock',
}

/**
 * The app lock: a 6-digit PIN, with Face ID as the shortcut. Changing the PIN or turning the lock off asks for the
 * current PIN first. The pads come up in one sheet. The web's AppLockSection.
 */
export function AppLockPage() {
  const { colors, fonts } = useTheme()
  const config = useLiveQuery(() => appLockRepo.get(), [])
  const [faceIdAvailable, setFaceIdAvailable] = useState(false)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const { busy, error, clearError, turnOn, changePin, addFaceId, removeFaceId } = useLockSetup({
    faceIdFailedLine: "Face ID didn't confirm, so it's still off. Try again.",
  })
  // A new key restarts the pad after a failed save.
  const [padKey, setPadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    void isFaceIdAvailable().then((value) => {
      if (!cancelled) setFaceIdAvailable(value)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (config === undefined) return null
  const on = config !== null
  const faceIdOn = config?.credentialId !== undefined
  const open = (next: Dialog) => {
    clearError()
    setDialog(next)
  }
  const close = () => {
    clearError()
    setDialog(null)
  }
  const savePin = async (pin: string, first: boolean) => {
    if (busy) return
    if (await (first ? turnOn(pin) : changePin(pin))) setDialog(null)
    else setPadKey((key) => key + 1)
  }

  return (
    <Card>
      <Muted top={0}>
        Lock the app with a 6-digit PIN, and Face ID as the shortcut. It asks when the app opens and when you come back after more than a minute away. Your
        photos, weight and notes stay hidden until then, even in the app switcher.
      </Muted>

      {!on ? (
        <Button label="Turn on the app lock" onPress={() => open('setup')} style={settingsStyles.top} />
      ) : (
        <View style={settingsStyles.stack}>
          {!config.pin && (
            <View style={[styles.nudge, { backgroundColor: colors.worldSoft }]}>
              <Text style={[styles.nudgeText, { color: colors.ink, fontFamily: fonts.rounded.semibold }]}>Choose a PIN, for when Face ID can&apos;t unlock the app.</Text>
              <Button label="Choose a PIN" onPress={() => open('choosePin')} style={settingsStyles.top} />
            </View>
          )}
          {(faceIdAvailable || faceIdOn) && (
            <Toggle checked={faceIdOn} onChange={(enable) => void (busy ? undefined : enable ? addFaceId() : removeFaceId())} label="Also unlock with Face ID" />
          )}
          {config.pin && <Button variant="secondary" label="Change PIN" onPress={() => open('changeCheck')} />}
          <Button variant="secondary" label="Turn off the app lock" onPress={() => (config.pin ? open('offCheck') : void appLockRepo.disable())} />
        </View>
      )}
      {error !== null && dialog === null && <StatusLine error>{error}</StatusLine>}

      <Muted size={12} top={12}>
        The PIN is never stored as typed, and never leaves this phone, not even in backups. It&apos;s a privacy lock, not encryption: it keeps the app closed to
        someone holding your phone.
      </Muted>

      <Sheet open={dialog !== null} onClose={close} label={dialog ? DIALOG_LABELS[dialog] : 'App lock'}>
        <View style={styles.dialog}>
          {dialog === 'setup' && <NewPinFlow key={padKey} onDone={(pin) => void savePin(pin, true)} />}
          {dialog === 'choosePin' && <NewPinFlow key={padKey} faceId={faceIdOn} onDone={(pin) => void savePin(pin, false)} />}
          {dialog === 'changeCheck' && <CheckPinPad title="Enter your current PIN" onVerified={() => setDialog('changeNew')} />}
          {dialog === 'changeNew' && <NewPinFlow key={padKey} title="Choose a new PIN" faceId={faceIdOn} onDone={(pin) => void savePin(pin, false)} />}
          {dialog === 'offCheck' && <CheckPinPad title="Enter your PIN to turn the lock off" onVerified={() => void appLockRepo.disable().then(close)} />}
          {busy && <Muted top={8}>Saving…</Muted>}
          {error !== null && <StatusLine error>{error}</StatusLine>}
          <Button variant="secondary" label="Cancel" onPress={close} style={styles.cancel} />
        </View>
      </Sheet>
    </Card>
  )
}

const styles = StyleSheet.create({
  nudge: { borderRadius: 16, padding: 12 },
  nudgeText: { fontSize: 14 },
  dialog: { alignItems: 'center', paddingVertical: 8 },
  cancel: { marginTop: 16, alignSelf: 'stretch' },
})

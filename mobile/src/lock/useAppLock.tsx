import { shouldRelock } from '@logic/appLock'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AppState, StyleSheet, View } from 'react-native'
import { Mascot } from '../components/mascot/Mascot'
import { appLockRepo, type PinResult } from '../db/repositories/appLockRepo'
import { useLiveQuery } from '../db/useLiveQuery'
import { useTheme } from '../theme/ThemeProvider'
import { askFaceId, isAuthenticating } from './faceId'
import { LockScreen } from './LockScreen'
import { hashPin } from './pin'
import { setLockStatus, type LockStatus } from './store'

const NO_FAILURES = { count: 0, lockedUntil: null }

/**
 * The app lock, at the app's root: a PIN, with Face ID as the shortcut. Locked when the app opens (if the lock is
 * on) and again after more than a minute in another app; turning it on mid-session doesn't lock you out at once.
 * Under the lock the app stays mounted (you come back where you were), hidden from VoiceOver, with every Modal
 * hidden too (see `useCurtained`). While the app is inactive or in the background, a cover hides it from the app
 * switcher. The web's useAppLock and the lock in App.tsx.
 */
export function AppLock({ children }: { children: ReactNode }) {
  const { colors } = useTheme()
  const config = useLiveQuery(() => appLockRepo.get(), [])
  const failures = useLiveQuery(() => appLockRepo.getFailures(), [])
  const enabled = config !== undefined && config !== null
  const [unlocked, setUnlocked] = useState(false)
  const [covered, setCovered] = useState(false)
  const hiddenAt = useRef<number | null>(null)

  // The lock turned on during this session (from Settings, or the offer after the deal) doesn't lock the app at once.
  const [previouslyEnabled, setPreviouslyEnabled] = useState<boolean | undefined>(undefined)
  if (config !== undefined && previouslyEnabled !== enabled) {
    setPreviouslyEnabled(enabled)
    if (enabled && previouslyEnabled === false) setUnlocked(true)
  }

  useEffect(() => {
    if (!enabled) return
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        hiddenAt.current ??= Date.now()
        setCovered(true)
      } else if (state === 'inactive') {
        // The app switcher's snapshot is taken now. The Face ID prompt makes the app inactive too: not a leaving.
        if (!isAuthenticating()) setCovered(true)
      } else if (state === 'active') {
        setCovered(false)
        if (shouldRelock(hiddenAt.current, Date.now())) setUnlocked(false)
        hiddenAt.current = null
      }
    })
    return () => subscription.remove()
  }, [enabled])

  const status: LockStatus = config === undefined ? 'loading' : enabled && !unlocked ? 'locked' : 'open'
  useEffect(() => setLockStatus(status), [status])
  // Gone (erased, in tests): nothing stays curtained.
  useEffect(() => () => setLockStatus('open'), [])

  const faceIdEnabled = config?.credentialId !== undefined

  const confirmFaceId = (): Promise<boolean> => (faceIdEnabled ? askFaceId('Unlock the app') : Promise.resolve(false))
  const unlockWithFaceId = async (): Promise<boolean> => {
    const verified = await confirmFaceId()
    if (verified) {
      await appLockRepo.resetFailures()
      setUnlocked(true)
    }
    return verified
  }
  const unlockWithPin = async (pin: string): Promise<PinResult> => {
    const result = await appLockRepo.checkPin(pin)
    if (result.ok) setUnlocked(true)
    return result
  }
  /** After Face ID passed ("Forgot PIN?"): saves the new PIN and opens the app. */
  const resetPinAndUnlock = async (pin: string): Promise<void> => {
    await appLockRepo.setPin(await hashPin(pin))
    setUnlocked(true)
  }
  const bypass = async (): Promise<void> => {
    await appLockRepo.bypass()
    setUnlocked(true)
  }

  if (status === 'loading') return <View style={[styles.fill, { backgroundColor: colors.canvas }]} />
  const locked = status === 'locked'
  return (
    <View style={styles.fill}>
      <View style={styles.fill} accessibilityElementsHidden={locked} importantForAccessibility={locked ? 'no-hide-descendants' : 'auto'}>
        {children}
      </View>
      {locked && (
        <LockScreen
          faceIdEnabled={faceIdEnabled}
          failures={failures ?? NO_FAILURES}
          onFaceId={unlockWithFaceId}
          onPin={unlockWithPin}
          onConfirmFaceId={confirmFaceId}
          onResetPin={resetPinAndUnlock}
          onBypass={bypass}
        />
      )}
      {covered && enabled && !locked && (
        <View testID="privacy-cover" style={[StyleSheet.absoluteFill, styles.cover, { backgroundColor: colors.canvas }]}>
          <Mascot mood="watching" size={96} decorative />
        </View>
      )}
    </View>
  )
}

/** The App lock row's value: "Off", "PIN", "Face ID" or "PIN + Face ID"; undefined while reading. */
export function useLockValue(): string | undefined {
  const config = useLiveQuery(() => appLockRepo.get(), [])
  if (config === undefined) return undefined
  if (config === null) return 'Off'
  return config.credentialId ? (config.pin ? 'PIN + Face ID' : 'Face ID') : 'PIN'
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  cover: { alignItems: 'center', justifyContent: 'center' },
})

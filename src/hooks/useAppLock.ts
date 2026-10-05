import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useRef, useState } from 'react'
import { appLockRepo, type PinResult } from '../db/repositories/appLockRepo'
import { shouldRelock, verifyOwner } from '../lib/appLock'
import { hashPin } from '../lib/pin'

export type AppLockStatus = 'loading' | 'locked' | 'open'

export type { PinResult }

/**
 * The app lock, at the app root: a PIN, with Face ID as the shortcut.
 * Locked when the app opens (if the lock is on) and again after more than a
 * minute in another app. While the app is in the background its content is
 * covered (`data-covered` on <html>, set synchronously so the iPhone app
 * switcher's snapshot doesn't show it). Turning the lock on mid-session
 * doesn't lock you out at once.
 */
export function useAppLock() {
  const config = useLiveQuery(() => appLockRepo.get(), [])
  const failures = useLiveQuery(() => appLockRepo.getFailures(), [])
  const enabled = config !== undefined && config !== null
  const [unlocked, setUnlocked] = useState(false)
  const hiddenAt = useRef<number | null>(null)

  // Compare with the previous render during render: the lock turned on
  // during this session (from Settings) shouldn't lock the app right away.
  const [previouslyEnabled, setPreviouslyEnabled] = useState<boolean | undefined>(undefined)
  if (config !== undefined && previouslyEnabled !== enabled) {
    setPreviouslyEnabled(enabled)
    if (enabled && previouslyEnabled === false) setUnlocked(true)
  }

  useEffect(() => {
    const root = document.documentElement
    if (!enabled) {
      root.removeAttribute('data-covered')
      return
    }
    const onVisibilityChange = () => {
      if (document.hidden) {
        hiddenAt.current = Date.now()
        root.setAttribute('data-covered', '')
      } else {
        root.removeAttribute('data-covered')
        if (shouldRelock(hiddenAt.current, Date.now())) setUnlocked(false)
        hiddenAt.current = null
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      root.removeAttribute('data-covered')
    }
  }, [enabled])

  const credentialId = config?.credentialId
  const storedPin = config?.pin

  /** Asks for Face ID without opening the app (to reset a forgotten PIN). */
  const confirmFaceId = useCallback(async (): Promise<boolean> => {
    return credentialId ? verifyOwner(credentialId) : false
  }, [credentialId])

  const unlockWithFaceId = useCallback(async (): Promise<boolean> => {
    const verified = await confirmFaceId()
    if (verified) {
      await appLockRepo.resetFailures()
      setUnlocked(true)
    }
    return verified
  }, [confirmFaceId])

  const unlockWithPin = useCallback(async (pin: string): Promise<PinResult> => {
    const result = await appLockRepo.checkPin(pin)
    if (result.ok) setUnlocked(true)
    return result
  }, [])

  /** After Face ID passed ("Forgot PIN?"): saves the new PIN and opens the app. */
  const resetPinAndUnlock = useCallback(async (pin: string): Promise<void> => {
    await appLockRepo.setPin(await hashPin(pin))
    setUnlocked(true)
  }, [])

  const bypass = useCallback(async (): Promise<void> => {
    await appLockRepo.bypass()
    setUnlocked(true)
  }, [])

  const status: AppLockStatus = config === undefined ? 'loading' : enabled && !unlocked ? 'locked' : 'open'
  return {
    status,
    faceIdEnabled: credentialId !== undefined,
    hasPin: storedPin !== undefined,
    failures: failures ?? { count: 0, lockedUntil: null },
    unlockWithFaceId,
    unlockWithPin,
    confirmFaceId,
    resetPinAndUnlock,
    bypass,
  }
}

import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useRef, useState } from 'react'
import { appLockRepo } from '../db/repositories/appLockRepo'
import { shouldRelock, verifyOwner } from '../lib/appLock'

export type AppLockStatus = 'loading' | 'locked' | 'open'

/**
 * The Face ID lock, at the app root. Locked when the app opens (if the lock
 * is on) and again after more than a minute in another app. While the app
 * is in the background its content is covered (`data-covered` on <html>,
 * set synchronously so the iPhone app switcher's snapshot doesn't show it).
 * Turning the lock on mid-session doesn't lock you out at once.
 */
export function useAppLock() {
  const config = useLiveQuery(() => appLockRepo.get(), [])
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
  const unlock = useCallback(async (): Promise<boolean> => {
    if (!credentialId) return true
    const verified = await verifyOwner(credentialId)
    if (verified) setUnlocked(true)
    return verified
  }, [credentialId])

  const bypass = useCallback(async (): Promise<void> => {
    await appLockRepo.bypass()
    setUnlocked(true)
  }, [])

  const status: AppLockStatus = config === undefined ? 'loading' : enabled && !unlocked ? 'locked' : 'open'
  return { status, unlock, bypass }
}

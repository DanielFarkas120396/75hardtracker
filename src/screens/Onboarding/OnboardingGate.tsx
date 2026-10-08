import { useLiveQuery } from 'dexie-react-hooks'
import { lazy, Suspense, useState, type ReactNode } from 'react'
import { db } from '../../db/db'
import { appLockRepo } from '../../db/repositories/appLockRepo'
import { profileRepo } from '../../db/repositories/profileRepo'
import { ProfileContext } from '../../hooks/useProfile'
import { InstallFirst } from './InstallFirst'
import { LockOffer } from './LockOffer'

// Only shown once per install, so it loads on demand; the service worker precaches the chunk.
const OnboardingFlow = lazy(() => import('./OnboardingFlow').then((m) => ({ default: m.OnboardingFlow })))

/** What the gate shows once the data is loaded. Kept for the session: the lock offer only follows the flow. */
type Shown = 'flow' | 'offer' | 'app'

interface OnboardingGateProps {
  today: string
  /** Shown while the profile loads, and while the flow's code does. */
  loading: ReactNode
  children: ReactNode
}

/**
 * Shows the welcome flow until the player has a profile, then the app with
 * the profile provided. The flow is for a new player when there are no
 * attempts at all, and for a returning one (name and reason only) otherwise.
 * A profile that appears while the flow is showing (the deal signed, or a
 * backup restored) brings the lock offer first, unless the lock is on.
 */
export function OnboardingGate({ today, loading, children }: OnboardingGateProps) {
  const state = useLiveQuery(
    async () => ({
      profile: await profileRepo.get(),
      hasAttempts: (await db.challenges.count()) > 0,
      lock: await appLockRepo.get(),
    }),
    [],
  )
  const [shown, setShown] = useState<Shown>('app')

  if (!state) return loading
  const { profile, lock } = state

  // Set during render, not in an effect, so the app never flashes between the flow and the offer.
  if (!profile) {
    if (shown !== 'flow') setShown('flow')
    return (
      <InstallFirst>
        <Suspense fallback={loading}>
          <OnboardingFlow mode={state.hasAttempts ? 'returning' : 'new'} today={today} />
        </Suspense>
      </InstallFirst>
    )
  }
  // Latched once shown: the PIN saved on the offer turns the lock on, and the Face ID question still follows.
  const offer = shown === 'offer' || (shown === 'flow' && lock === null)
  if (shown === 'flow') setShown(offer ? 'offer' : 'app')
  if (offer) return <LockOffer name={profile.name} onDone={() => setShown('app')} />
  return <ProfileContext.Provider value={profile}>{children}</ProfileContext.Provider>
}

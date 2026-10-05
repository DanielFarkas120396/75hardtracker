import { useLiveQuery } from 'dexie-react-hooks'
import { lazy, Suspense, type ReactNode } from 'react'
import { db } from '../../db/db'
import { profileRepo } from '../../db/repositories/profileRepo'
import { ProfileContext } from '../../hooks/useProfile'
import { InstallFirst } from './InstallFirst'

// Only shown once per install, so it loads on demand; the service worker precaches the chunk.
const OnboardingFlow = lazy(() => import('./OnboardingFlow').then((m) => ({ default: m.OnboardingFlow })))

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
 */
export function OnboardingGate({ today, loading, children }: OnboardingGateProps) {
  const state = useLiveQuery(
    async () => ({ profile: await profileRepo.get(), hasAttempts: (await db.challenges.count()) > 0 }),
    [],
  )

  if (!state) return loading
  if (!state.profile) {
    return (
      <InstallFirst>
        <Suspense fallback={loading}>
          <OnboardingFlow mode={state.hasAttempts ? 'returning' : 'new'} today={today} />
        </Suspense>
      </InstallFirst>
    )
  }
  return <ProfileContext.Provider value={state.profile}>{children}</ProfileContext.Provider>
}

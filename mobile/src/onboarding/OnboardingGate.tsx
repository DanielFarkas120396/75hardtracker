import type { ReactNode } from 'react'
import { View } from 'react-native'
import { challengeRepo } from '../db/repositories/challengeRepo'
import { profileRepo } from '../db/repositories/profileRepo'
import { useLiveQuery } from '../db/useLiveQuery'
import { useToday } from '../hooks/useToday'
import { useTheme } from '../theme/ThemeProvider'
import { loadDraft } from './draftStore'
import { OnboardingFlow } from './OnboardingFlow'

/**
 * Decides between the welcome flow and the app, as the web's OnboardingGate
 * does: no profile means the flow (for a new player, or a returning one whose
 * attempts came back from a backup); a profile means the app. The swap happens
 * by itself when the profile appears (the deal is signed, or a backup is restored).
 */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const { colors } = useTheme()
  const today = useToday()
  // The draft is read with the rest, every time: one kept from the launch would bring old answers
  // back after "Erase everything". The flow only looks at it when it opens. A draft that can't be
  // read only costs retyping.
  const state = useLiveQuery(async () => {
    const hasProfile = (await profileRepo.get()) !== undefined
    return {
      hasProfile,
      hasAttempts: (await challengeRepo.getAll()).length > 0,
      draft: hasProfile ? null : await loadDraft().catch(() => null),
    }
  }, [])

  if (state === undefined) return <View style={{ flex: 1, backgroundColor: colors.canvas }} />
  if (state.hasProfile) return children
  return <OnboardingFlow mode={state.hasAttempts ? 'returning' : 'new'} today={today} draft={state.draft} />
}

import type { OnboardingDraft } from '@logic/onboardingDraft'
import { useEffect, useState, type ReactNode } from 'react'
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
  const state = useLiveQuery(
    async () => ({
      hasProfile: (await profileRepo.get()) !== undefined,
      hasAttempts: (await challengeRepo.getAll()).length > 0,
    }),
    [],
  )
  const [draft, setDraft] = useState<OnboardingDraft | null | undefined>(undefined)
  useEffect(() => {
    let gone = false
    loadDraft().then(
      (loaded) => {
        if (!gone) setDraft(loaded)
      },
      () => {
        if (!gone) setDraft(null)
      },
    )
    return () => {
      gone = true
    }
  }, [])

  if (state === undefined) return <View style={{ flex: 1, backgroundColor: colors.canvas }} />
  if (state.hasProfile) return children
  if (draft === undefined) return <View style={{ flex: 1, backgroundColor: colors.canvas }} />
  return <OnboardingFlow mode={state.hasAttempts ? 'returning' : 'new'} today={today} draft={draft} />
}

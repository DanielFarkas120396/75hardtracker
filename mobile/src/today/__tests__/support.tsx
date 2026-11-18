import { todayISO } from '@logic/dates'
import type { ChallengeVariant } from '@logic/rulesets'
import type { ReactNode } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { addChallenge } from '../../db/__tests__/fixtures'
import { dayEntryRepo } from '../../db/repositories/dayEntryRepo'
import { profileRepo } from '../../db/repositories/profileRepo'
import { ThemeProvider } from '../../theme/ThemeProvider'

// What the Today tests share. Not a test file itself.

const PHONE = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }

/** The theme and a phone's safe areas, as the app's root gives them. */
export const Providers = ({ children }: { children: ReactNode }) => (
  <SafeAreaProvider initialMetrics={PHONE}>
    <ThemeProvider>{children}</ThemeProvider>
  </SafeAreaProvider>
)

export const TODAY = todayISO()

/** A player with a profile and an attempt whose Day `day` is today. Returns the attempt's id. */
export async function startAttempt(day = 1, variant: ChallengeVariant = 'hard'): Promise<number> {
  const start = new Date()
  start.setDate(start.getDate() - (day - 1))
  const challengeId = await addChallenge({ startDate: todayISO(start), attemptNumber: 1, status: 'active', variant })
  await profileRepo.completeOnboarding({ name: 'Daniel', why: 'A fresh start' })
  return challengeId
}

/** Today's entry of an attempt started with `startAttempt(day)`. */
export const entryOf = (challengeId: number, day = 1) => dayEntryRepo.getOrCreate({ challengeId, dayNumber: day, date: TODAY })

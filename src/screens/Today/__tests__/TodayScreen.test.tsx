import { render, screen } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../../db/db'
import { addChallenge, freshDatabase, TEST_PROFILE } from '../../../db/__tests__/fixtures'
import { dayEntryRepo } from '../../../db/repositories/dayEntryRepo'
import type { Challenge } from '../../../db/types'
import { ProfileContext } from '../../../hooks/useProfile'
import { addDaysISO, todayISO } from '../../../lib/dates'
import type { Profile } from '../../../logic/profile'
import type { ChallengeVariant } from '../../../logic/rulesets'
import { TodayScreen } from '../TodayScreen'

/** Seeds an active challenge and today's entry, then renders TodayScreen with the props App passes. */
async function setup({
  variant = 'hard' as ChallengeVariant,
  todayDayNumber = 3,
  jokersLeft = 0,
  socialDays,
  profile,
}: {
  variant?: ChallengeVariant
  todayDayNumber?: number
  jokersLeft?: number
  socialDays?: number[]
  profile?: Profile
} = {}) {
  const today = todayISO()
  const startDate = addDaysISO(today, -(todayDayNumber - 1))
  const challengeId = await addChallenge({
    startDate,
    attemptNumber: 1,
    status: 'active',
    variant,
    ...(socialDays ? { socialDays } : {}),
  })
  const challenge = (await db.challenges.get(challengeId)) as Challenge
  await dayEntryRepo.getOrCreate({ challengeId, dayNumber: todayDayNumber, date: today })
  const dayEntries = await dayEntryRepo.getAllForChallenge(challengeId)

  render(
    <ProfileContext.Provider value={profile}>
      <TodayScreen
        challenge={challenge}
        dayEntries={dayEntries}
        today={today}
        todayDayNumber={todayDayNumber}
        streak={0}
        jokersLeft={jokersLeft}
      />
    </ProfileContext.Provider>,
  )
  return { challenge, today }
}

describe('TodayScreen', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  beforeEach(freshDatabase)

  it("ignores a stray socialDays entry on a Hard row: keeps the alcohol toggle instead of the drink-allowed line", async () => {
    await setup({ variant: 'hard', todayDayNumber: 3, socialDays: [3] })

    expect(await screen.findByRole('switch', { name: 'No alcohol' })).toBeInTheDocument()
    expect(screen.queryByText('🥂 Social occasion today — a drink is allowed.')).not.toBeInTheDocument()
  })

  it('Hard on Day 3: names the attempt, and offers no joker, recovery or social controls', async () => {
    await setup({ variant: 'hard', todayDayNumber: 3 })

    expect(await screen.findByText('75 Hard · Attempt #1')).toBeInTheDocument()
    expect(screen.queryByText(/joker/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Take my recovery day' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '🥂 Plan a social occasion' })).not.toBeInTheDocument()
    expect(screen.queryByText(/^Doing 75 Hard\./)).not.toBeInTheDocument()
  })

  it('Medium on Day 1: shows the joker chip, the switch-challenge hint and the plan-a-social-occasion button', async () => {
    await setup({ variant: 'medium', todayDayNumber: 1, jokersLeft: 1 })

    expect(await screen.findByText('🃏 1 joker left')).toBeInTheDocument()
    expect(
      screen.getByText('Doing 75 Medium. You can switch challenge in Settings until the end of Day 1.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '🥂 Plan a social occasion' })).toBeInTheDocument()
  })

  it('Strong on Day 3 with a declared occasion: shows the drink-allowed note', async () => {
    await setup({ variant: 'strong', todayDayNumber: 3, socialDays: [3] })

    expect(await screen.findByText('🥂 Social occasion today — a drink is allowed.')).toBeInTheDocument()
  })

  it('greets the player by name and keeps their reason in view', async () => {
    await setup({ todayDayNumber: 3, profile: TEST_PROFILE })

    expect(await screen.findByText('Hey Daniel')).toBeInTheDocument()
    expect(screen.getByText('“A fresh start”')).toBeInTheDocument()
  })

  it('shows no greeting or reason without a profile', async () => {
    await setup({ todayDayNumber: 3 })

    expect(await screen.findByText('75 Hard · Attempt #1')).toBeInTheDocument()
    expect(screen.queryByText(/^Hey /)).not.toBeInTheDocument()
    expect(screen.queryByText('“A fresh start”')).not.toBeInTheDocument()
  })
})

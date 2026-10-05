import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  pendingLateDay = null,
}: {
  variant?: ChallengeVariant
  todayDayNumber?: number
  jokersLeft?: number
  socialDays?: number[]
  profile?: Profile
  pendingLateDay?: number | null
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
  // In the app the gate's live entries pick up yesterday's entry once it's created; here it exists up front.
  if (pendingLateDay !== null) {
    await dayEntryRepo.getOrCreate({ challengeId, dayNumber: pendingLateDay, date: addDaysISO(today, -1) })
  }
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
        pendingLateDay={pendingLateDay}
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

    fireEvent.click(await screen.findByRole('button', { name: /^Diet,/ }))
    expect(await screen.findByRole('switch', { name: 'No alcohol' })).toBeInTheDocument()
    expect(screen.queryByText('🥂 Social occasion today — a drink is allowed.')).not.toBeInTheDocument()
  })

  it('Hard on Day 3: names the attempt, and offers no joker, recovery or social controls', async () => {
    await setup({ variant: 'hard', todayDayNumber: 3 })

    expect(await screen.findByText('75 Hard · #1')).toBeInTheDocument()
    expect(screen.queryByText(/joker/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Plan a social occasion' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^Workouts,/ }))
    expect(await screen.findByRole('dialog', { name: 'Workouts' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Take my recovery day' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    fireEvent.click(screen.getByRole('button', { name: /^Diet,/ }))
    expect(await screen.findByRole('dialog', { name: 'Diet' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '🥂 Plan a social occasion' })).not.toBeInTheDocument()
  })

  it('Medium on Day 1: shows the joker chip, and the diet tile opens the social sheet in one tap', async () => {
    await setup({ variant: 'medium', todayDayNumber: 1, jokersLeft: 1 })

    expect(await screen.findByText('1 joker left')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Plan a social occasion' }))
    expect(await screen.findByRole('heading', { name: 'Plan a social occasion' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    fireEvent.click(screen.getByRole('button', { name: /^Diet,/ }))
    expect(await screen.findByRole('button', { name: '🥂 Plan a social occasion' })).toBeInTheDocument()
  })

  it('Strong on Day 3 with a declared occasion: shows the drink-allowed note', async () => {
    await setup({ variant: 'strong', todayDayNumber: 3, socialDays: [3] })

    expect(await screen.findByRole('button', { name: 'Diet, 1 to tick' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Diet, 1 to tick' }))
    expect(await screen.findByText('🥂 Social occasion today — a drink is allowed.')).toBeInTheDocument()
  })

  it('keeps the reason in view', async () => {
    await setup({ todayDayNumber: 3, profile: TEST_PROFILE })

    expect(await screen.findByText('“A fresh start”')).toBeInTheDocument()
  })

  it('shows no reason without a profile', async () => {
    await setup({ todayDayNumber: 3 })

    expect(await screen.findByText('75 Hard · #1')).toBeInTheDocument()
    expect(screen.queryByText('“A fresh start”')).not.toBeInTheDocument()
  })

  it('logs a glass of water and a page straight from the tiles', async () => {
    // The entries are a static prop here (the gate's live query feeds them in the app), so the stores are checked.
    const { challenge, today } = await setup({ variant: 'hard', todayDayNumber: 3 })
    const entry = () => dayEntryRepo.getOrCreate({ challengeId: challenge.id, dayNumber: 3, date: today })

    fireEvent.click(await screen.findByRole('button', { name: 'Add 250 ml' }))
    await waitFor(async () => expect((await entry()).water_ml).toBe(250))

    fireEvent.click(screen.getByRole('button', { name: 'Add 1 page' }))
    await waitFor(async () => expect((await entry()).pages_read).toBe(1))

    expect(screen.getByRole('button', { name: 'Take photo' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Add .*workout/i })).not.toBeInTheDocument()
  })

  it("offers to finish yesterday in the morning, on yesterday's own tasks, and back", async () => {
    await setup({ variant: 'hard', todayDayNumber: 3, pendingLateDay: 2 })

    expect(await screen.findByRole('heading', { name: "Day 2 isn't finished" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Finish it' }))

    expect(await screen.findByRole('heading', { name: 'Finish Day 2' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Choose from library' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Take photo' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Photo,/ }))
    expect(await screen.findByText("Yesterday's photo, from your library.")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '🖼️ Choose from library' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Take photo/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    fireEvent.click(screen.getByRole('button', { name: 'Today' }))
    expect(await screen.findByRole('heading', { name: /Day 3/ })).toBeInTheDocument()
  })

  it('shows nothing about yesterday once it is done or past noon', async () => {
    await setup({ variant: 'hard', todayDayNumber: 3 })
    expect(await screen.findByText('75 Hard · #1')).toBeInTheDocument()
    expect(screen.queryByText(/isn't finished/)).not.toBeInTheDocument()
  })
})

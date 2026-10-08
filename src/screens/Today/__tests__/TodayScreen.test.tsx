import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../../db/db'
import { addChallenge, freshDatabase, TEST_PROFILE } from '../../../db/__tests__/fixtures'
import { dayEntryRepo } from '../../../db/repositories/dayEntryRepo'
import { workoutRepo } from '../../../db/repositories/workoutRepo'
import type { Challenge } from '../../../db/types'
import { ProfileContext } from '../../../hooks/useProfile'
import { addDaysISO, todayISO } from '../../../lib/dates'
import type { Profile } from '../../../logic/profile'
import type { ChallengeVariant } from '../../../logic/rulesets'
import { TodayScreen } from '../TodayScreen'

// The clock, in minutes since midnight: morning unless a test says otherwise.
const clock = vi.hoisted(() => ({ nowMin: 9 * 60 }))
vi.mock('../../../hooks/useNow', () => ({ useNow: () => clock.nowMin }))

/** Seeds an active challenge and today's entry, then renders TodayScreen with the props App passes. */
async function setup({
  variant = 'hard' as ChallengeVariant,
  todayDayNumber = 3,
  jokersLeft = 0,
  socialDays,
  profile,
  pendingLateDay = null,
  complete = false,
}: {
  variant?: ChallengeVariant
  todayDayNumber?: number
  jokersLeft?: number
  socialDays?: number[]
  profile?: Profile
  pendingLateDay?: number | null
  /** Every task of today logged. */
  complete?: boolean
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
  const todayEntry = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: todayDayNumber, date: today })
  if (complete) {
    await dayEntryRepo.update(todayEntry.id, { water_ml: 3800, pages_read: 10, dietFollowed: true, noAlcohol: true, photoId: 1 })
    for (const isOutdoor of [true, false]) {
      await workoutRepo.add({ dayEntryId: todayEntry.id, type: 'Running', durationMin: 45, isOutdoor })
    }
  }
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

  beforeEach(async () => {
    clock.nowMin = 9 * 60
    await freshDatabase()
  })

  it('in the morning: the duck has his own line, the ring is named, and the plan sits under the board', async () => {
    await setup({ variant: 'hard', todayDayNumber: 3 })

    // He speaks FIRST_LINE_DELAY_MS after Today mounts. Under a loaded test run, the mount alone can block the thread for seconds.
    const line = await screen.findByText("New day. I'm watching.", undefined, { timeout: 10_000 })
    expect(line.closest('[aria-live="polite"]')).not.toBeNull()
    expect(screen.getByRole('img', { name: '0 of 5 tasks done' })).toHaveTextContent('0/5')
    expect(screen.queryByText(/^\d+h\d\d left$|^\d+ min left$/)).not.toBeInTheDocument()
    // Day 3 with no streak: no grey "0" flame.
    expect(screen.queryByText('0', { ignore: 'script, style, svg[role="img"] text' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Plan my evening' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Workouts,/ }).parentElement!).not.toHaveClass('ring-danger-ink')
  })

  it('at 22:30 with everything left: the time left, and only the open tasks keep a tile', async () => {
    clock.nowMin = 22 * 60 + 30
    await setup({ variant: 'hard', todayDayNumber: 3 })

    expect(await screen.findByText('1h30 left')).toBeInTheDocument()
    // Red only on what no longer fits before midnight: the water (3.8 L) does, two workouts (90 min) just fit.
    expect(screen.getByRole('button', { name: /^Water,/ }).parentElement!).toHaveClass('ring-danger-ink')
    expect(screen.getByRole('button', { name: /^Workouts,/ }).parentElement!).toHaveClass('ring-ink/30')
    expect(screen.getByRole('button', { name: /^Workouts,/ }).parentElement!).not.toHaveClass('ring-danger-ink')
    // He's hunting: nothing left to plan, only to do.
    expect(screen.queryByRole('button', { name: 'Plan my evening' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Notes' })).toBeInTheDocument()
  })

  it('at 5/5: the day is won, and the hero asks how it went instead of the plan', async () => {
    await setup({ variant: 'hard', todayDayNumber: 3, complete: true })

    expect(await screen.findByText('Day 3 won')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '5 of 5 tasks done' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Plan my evening' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Notes' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'How did it go?' }))
    expect(await screen.findByRole('dialog', { name: 'Mood & notes' })).toBeInTheDocument()
  })

  it("ignores a stray socialDays entry on a Hard row: keeps the alcohol toggle instead of the drink-allowed line", async () => {
    await setup({ variant: 'hard', todayDayNumber: 3, socialDays: [3] })

    fireEvent.click(await screen.findByRole('button', { name: /^Diet,/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Diet' })
    expect(within(sheet).getByRole('switch', { name: 'No alcohol' })).toBeInTheDocument()
    expect(screen.queryByText('🥂 Social occasion today — a drink is allowed.')).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /Social occasion today/ })).not.toBeInTheDocument()
  })

  it('Hard on Day 3: names the attempt, and offers no joker, recovery or social controls', async () => {
    await setup({ variant: 'hard', todayDayNumber: 3 })

    expect(await screen.findByText('75 Hard #1')).toBeInTheDocument()
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

  it('Medium on Day 1: shows the joker chip, and the hero opens the social sheet in one tap', async () => {
    await setup({ variant: 'medium', todayDayNumber: 1, jokersLeft: 1 })

    expect(await screen.findByText('1 joker')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Plan a social occasion' }))
    expect(await screen.findByRole('heading', { name: 'Plan a social occasion' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    fireEvent.click(screen.getByRole('button', { name: /^Diet,/ }))
    expect(await screen.findByRole('button', { name: '🥂 Plan a social occasion' })).toBeInTheDocument()
  })

  it('Strong on Day 3 with a declared occasion: shows the drink-allowed note', async () => {
    await setup({ variant: 'strong', todayDayNumber: 3, socialDays: [3] })

    expect(await screen.findByRole('button', { name: 'Diet, 1 to tick' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Social occasion today — a drink is allowed' })).toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: 'No alcohol' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Diet, 1 to tick' }))
    expect(await screen.findByText('🥂 Social occasion today — a drink is allowed.')).toBeInTheDocument()
  })

  it('ticks the diet and the alcohol straight from the tile', async () => {
    const { challenge, today } = await setup({ variant: 'hard', todayDayNumber: 3 })
    const entry = () => dayEntryRepo.getOrCreate({ challengeId: challenge.id, dayNumber: 3, date: today })

    fireEvent.click(await screen.findByRole('switch', { name: 'I followed my diet' }))
    await waitFor(async () => expect((await entry()).dietFollowed).toBe(true))

    fireEvent.click(screen.getByRole('switch', { name: 'No alcohol' }))
    await waitFor(async () => expect((await entry()).noAlcohol).toBe(true))
  })

  it('keeps the reason in view', async () => {
    await setup({ todayDayNumber: 3, profile: TEST_PROFILE })

    expect(await screen.findByText('“A fresh start”')).toBeInTheDocument()
  })

  it('shows no reason without a profile', async () => {
    await setup({ todayDayNumber: 3 })

    expect(await screen.findByText('75 Hard #1')).toBeInTheDocument()
    expect(screen.queryByText('“A fresh start”')).not.toBeInTheDocument()
  })

  it('logs a glass of water, a page and a workout straight from the tiles', async () => {
    // The entries are a static prop here (the gate's live query feeds them in the app), so the stores are checked.
    const { challenge, today } = await setup({ variant: 'hard', todayDayNumber: 3 })
    const entry = () => dayEntryRepo.getOrCreate({ challengeId: challenge.id, dayNumber: 3, date: today })

    fireEvent.click(await screen.findByRole('button', { name: 'Add 250 ml' }))
    await waitFor(async () => expect((await entry()).water_ml).toBe(250))
    // A stray tap is one tap to take back.
    expect(screen.getByRole('status')).toHaveTextContent('Logged 250 ml')
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(async () => expect((await entry()).water_ml).toBe(0))
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Add the 10 pages left' }))
    await waitFor(async () => expect((await entry()).pages_read).toBe(10))
    expect(screen.getByRole('status')).toHaveTextContent('Logged 10 pages')

    expect(screen.getByRole('button', { name: 'Take photo' })).toHaveTextContent('Snap')
    fireEvent.click(screen.getByRole('button', { name: 'Add workout' }))
    fireEvent.click(within(await screen.findByRole('group', { name: 'Activity' })).getByRole('button', { name: 'Yoga' }))
    fireEvent.click(within(screen.getByRole('group', { name: 'How did it feel?' })).getByRole('button', { name: 'Good' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(async () =>
      expect(await workoutRepo.getForDayEntry((await entry()).id)).toMatchObject([{ type: 'Yoga', durationMin: 45, feel: 4 }]),
    )
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
    expect(await screen.findByText('75 Hard #1')).toBeInTheDocument()
    expect(screen.queryByText(/isn't finished/)).not.toBeInTheDocument()
  })
})

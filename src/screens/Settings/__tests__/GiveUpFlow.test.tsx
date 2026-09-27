import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../../db/db'
import { addChallenge, freshDatabase } from '../../../db/__tests__/fixtures'
import { challengeRepo, type GiveUpResult } from '../../../db/repositories/challengeRepo'
import type { Challenge } from '../../../db/types'
import { addDaysISO, todayISO } from '../../../lib/dates'
import { GiveUpFlow } from '../GiveUpFlow'

// Step 2's numbers, without seeding a whole attempt's days.
const { stats } = vi.hoisted(() => ({ stats: { xp: 935, perfectDays: 11, water_ml: 0, pages: 0, workoutMinutes: 0 } }))
vi.mock('../../../hooks/useChallengeStats', () => ({ useChallengeStats: () => stats }))

const today = todayISO()

/** A 75 Hard attempt on `todayDayNumber`, with its 11-day streak and the flow open on step 1. */
async function setup(todayDayNumber = 12) {
  const challengeId = await addChallenge({
    startDate: addDaysISO(today, -(todayDayNumber - 1)),
    attemptNumber: 1,
    status: 'active',
    variant: 'hard',
  })
  const challenge = (await db.challenges.get(challengeId)) as Challenge
  const onClose = vi.fn()
  render(
    <GiveUpFlow
      open
      onClose={onClose}
      challenge={challenge}
      today={today}
      todayDayNumber={todayDayNumber}
      streak={11}
    />,
  )
  return { challengeId, onClose }
}

const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }))

/** One second of step 3's lock, on the fake clock. */
const tick = () =>
  act(() => {
    vi.advanceTimersByTime(1000)
  })

/**
 * Steps 1 and 2, then step 3's five-second lock on a fake clock (only
 * setTimeout is faked, so IndexedDB keeps working), then on to step 4.
 */
function reachStepFour() {
  click('Give up')
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  click("I'm sure")
  for (let second = 0; second < 5; second++) tick()
  vi.useRealTimers()
  click('Give up')
}

const typeConfirmation = (value: string) =>
  fireEvent.change(screen.getByRole('textbox', { name: 'Type GIVE UP to confirm' }), { target: { value } })

describe('GiveUpFlow', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  beforeEach(async () => {
    await freshDatabase()
    Object.assign(stats, { xp: 935, perfectDays: 11 })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('opens on what giving up means, and Keep going closes without giving up', async () => {
    const { challengeId, onClose } = await setup()

    expect(screen.getByRole('heading', { name: 'Give up 75 Hard?' })).toBeInTheDocument()
    expect(
      screen.getByText(
        "You're on Day 12 of 75. Giving up ends this attempt for good: you can't pick it back up. It stays in your history.",
      ),
    ).toBeInTheDocument()

    click('Keep going')

    expect(onClose).toHaveBeenCalledTimes(1)
    expect((await db.challenges.get(challengeId))?.status).toBe('active')
  })

  it('shows what the attempt built on step 2, focusing its heading, and I’ll stay closes', async () => {
    const { onClose } = await setup()
    click('Give up')

    expect(screen.getByRole('heading', { name: 'Look at what you built.' })).toHaveFocus()
    expect(screen.getByText('🔥 11-day streak · 11 perfect days · ⭐ 935 XP')).toBeInTheDocument()
    expect(screen.getByText("11 perfect days. You'd throw them away?")).toBeInTheDocument()

    click("I'll stay")
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('words step 2 for a single perfect day', async () => {
    stats.perfectDays = 1
    await setup()
    click('Give up')

    expect(screen.getByText('🔥 11-day streak · 1 perfect day · ⭐ 935 XP')).toBeInTheDocument()
    expect(screen.getByText("1 perfect day. You'd throw it away?")).toBeInTheDocument()
  })

  it('words step 2 for no perfect day at all', async () => {
    stats.perfectDays = 0
    await setup()
    click('Give up')

    expect(screen.getByText("Not one perfect day yet, and you're already out?")).toBeInTheDocument()
  })

  it('closes on Escape without giving up', async () => {
    const { challengeId, onClose } = await setup()
    click('Give up') // step 2

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
    expect((await db.challenges.get(challengeId))?.status).toBe('active')
  })

  it('locks Give up on step 3 for five seconds, counting down', async () => {
    const { onClose } = await setup()
    click('Give up')
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    click("I'm sure")

    expect(screen.getByRole('heading', { name: 'Last warning.' })).toBeInTheDocument()
    expect(screen.getByText("Tomorrow is Day 13. Quitters don't get a Day 13.")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Give up (5)' })).toBeDisabled()

    tick()
    expect(screen.getByRole('button', { name: 'Give up (4)' })).toBeDisabled()

    for (let second = 0; second < 4; second++) tick()
    expect(screen.getByRole('button', { name: 'Give up' })).toBeEnabled()

    click('Keep going')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('speaks of the finish line on Day 75', async () => {
    await setup(75)
    click('Give up')
    click("I'm sure")

    expect(screen.getByText("It's Day 75. Quitters don't get a finish line.")).toBeInTheDocument()
  })

  it('unlocks the last button only once GIVE UP is typed, then gives the attempt up', async () => {
    const { challengeId } = await setup()
    reachStepFour()

    expect(screen.getByRole('heading', { name: 'Type GIVE UP to confirm.' })).toBeInTheDocument()
    const confirm = screen.getByRole('button', { name: 'Give up for good' })
    expect(confirm).toBeDisabled()

    typeConfirmation('give')
    expect(confirm).toBeDisabled()
    typeConfirmation('GIVEUP')
    expect(confirm).toBeDisabled()
    typeConfirmation('  give   up ')
    expect(confirm).toBeEnabled()

    fireEvent.click(confirm)

    await waitFor(async () =>
      expect(await db.challenges.get(challengeId)).toMatchObject({ status: 'abandoned', abandonedOn: today }),
    )
  })

  it('shows Giving up… and locks both buttons while saving', async () => {
    vi.spyOn(challengeRepo, 'giveUp').mockReturnValueOnce(new Promise<GiveUpResult>(() => {}))
    await setup()
    reachStepFour()

    typeConfirmation('GIVE UP')
    click('Give up for good')

    expect(await screen.findByRole('button', { name: 'Giving up…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })

  it('lets Enter on the confirm field hide the keyboard instead of submitting', async () => {
    const giveUpSpy = vi.spyOn(challengeRepo, 'giveUp')
    await setup()
    reachStepFour()

    const field = screen.getByRole('textbox', { name: 'Type GIVE UP to confirm' })
    field.focus()
    expect(field).toHaveFocus()

    fireEvent.keyDown(field, { key: 'Enter' })

    expect(field).not.toHaveFocus()
    expect(giveUpSpy).not.toHaveBeenCalled()
  })

  it('closes on Cancel at the last step without giving up', async () => {
    const { challengeId, onClose } = await setup()
    reachStepFour()

    click('Cancel')

    expect(onClose).toHaveBeenCalledTimes(1)
    expect((await db.challenges.get(challengeId))?.status).toBe('active')
  })

  it('says so when the attempt can no longer be given up', async () => {
    const { challengeId } = await setup()
    reachStepFour()
    await db.challenges.update(challengeId, { status: 'completed' })

    typeConfirmation('GIVE UP')
    click('Give up for good')

    expect(await screen.findByRole('alert')).toHaveTextContent("This attempt can't be given up anymore.")
    expect(screen.getByRole('button', { name: 'Give up for good' })).toBeEnabled()
  })

  it('shows an error and re-enables the button when saving fails', async () => {
    vi.spyOn(challengeRepo, 'giveUp').mockRejectedValueOnce(new Error('quota'))
    await setup()
    reachStepFour()

    typeConfirmation('GIVE UP')
    click('Give up for good')

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't give up — try again.")
    expect(screen.getByRole('button', { name: 'Give up for good' })).toBeEnabled()
  })
})

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../../db/db'
import { addChallenge, freshDatabase } from '../../../db/__tests__/fixtures'
import { challengeRepo } from '../../../db/repositories/challengeRepo'
import type { Challenge } from '../../../db/types'
import { todayISO } from '../../../lib/dates'
import { JokerUsedScreen } from '../JokerUsedScreen'

/** A Medium challenge with no day entries at all — every day, including Day 3, is missing. */
async function setup(props: { newlyMissed: number[]; missedCount: number; jokersLeft: number }) {
  const challengeId = await addChallenge({
    startDate: todayISO(),
    attemptNumber: 1,
    status: 'active',
    variant: 'medium',
  })
  const challenge = (await db.challenges.get(challengeId)) as Challenge
  render(<JokerUsedScreen challenge={challenge} {...props} />)
  return { challengeId }
}

describe('JokerUsedScreen', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  beforeEach(freshDatabase)

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('announces one missed day, its missing tasks, and the last-joker line', async () => {
    await setup({ newlyMissed: [3], missedCount: 1, jokersLeft: 0 })

    expect(screen.getByText("Day 3 wasn't completed")).toBeInTheDocument()
    expect(screen.getByText('Joker used. 0 left.')).toBeInTheDocument()
    expect(screen.getByText("That was your last joker. Next time, it's Day 1.")).toBeInTheDocument()
    expect(screen.getByText("Your streak starts over. Your challenge doesn't.")).toBeInTheDocument()
    expect(await screen.findByText('✕ Ate healthy, no alcohol unless declared')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
  })

  it('moves focus to its heading, since it replaces the whole app', async () => {
    await setup({ newlyMissed: [3], missedCount: 1, jokersLeft: 0 })
    // Let the missed-task list load, so nothing updates after the test.
    await screen.findAllByRole('listitem')

    expect(screen.getByRole('heading', { name: "Day 3 wasn't completed" })).toHaveFocus()
  })

  it('calls acknowledgeJokers with the total missed count on Keep going', async () => {
    const { challengeId } = await setup({ newlyMissed: [3], missedCount: 1, jokersLeft: 0 })
    fireEvent.click(screen.getByRole('button', { name: 'Keep going' }))

    await waitFor(async () => expect((await db.challenges.get(challengeId))?.jokersAcknowledged).toBe(1))
  })

  it('announces several missed days with the plural line, per-day labels and the softer duck line', async () => {
    await setup({ newlyMissed: [12, 13], missedCount: 2, jokersLeft: 1 })

    expect(screen.getByText("Days 12 and 13 weren't completed")).toBeInTheDocument()
    expect(screen.getByText('2 jokers used. 1 left.')).toBeInTheDocument()
    expect(screen.getByText("I'll let that one go. Once.")).toBeInTheDocument()
    expect(screen.getByText('Day 12')).toBeInTheDocument()
    expect(screen.getByText('Day 13')).toBeInTheDocument()
  })

  it('joins three or more missed days with commas and "and"', async () => {
    await setup({ newlyMissed: [3, 4, 5], missedCount: 3, jokersLeft: 0 })

    expect(screen.getByText("Days 3, 4 and 5 weren't completed")).toBeInTheDocument()
  })

  it('shows an error and re-enables the button when saving fails', async () => {
    vi.spyOn(challengeRepo, 'acknowledgeJokers').mockRejectedValueOnce(new Error('quota'))
    await setup({ newlyMissed: [3], missedCount: 1, jokersLeft: 0 })
    fireEvent.click(screen.getByRole('button', { name: 'Keep going' }))

    expect(await screen.findByText("Couldn't save that — try again.")).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't save that — try again.")
    expect(screen.getByRole('button', { name: 'Keep going' })).toBeEnabled()
  })
})

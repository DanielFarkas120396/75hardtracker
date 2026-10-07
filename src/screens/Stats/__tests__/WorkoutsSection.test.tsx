import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../../db/db'
import { addChallenge, freshDatabase } from '../../../db/__tests__/fixtures'
import type { DayEntry, Workout } from '../../../db/types'
import { addDaysISO } from '../../../lib/dates'
import { WorkoutsSection } from '../WorkoutsSection'

const START = '2026-09-30'

/** Day 1: a run (Good) and weights; Day 2: a run (Great). */
async function seedAttempt(): Promise<number> {
  const challengeId = await addChallenge({ startDate: START, attemptNumber: 1, status: 'active' })
  const day = (dayNumber: number) =>
    db.dayEntries.add({
      challengeId,
      date: addDaysISO(START, dayNumber - 1),
      dayNumber,
      water_ml: 0,
      pages_read: 0,
      dietFollowed: false,
      noAlcohol: false,
      completed: false,
    } as DayEntry)
  const day1 = await day(1)
  const day2 = await day(2)
  await db.workouts.bulkAdd([
    { dayEntryId: day1, type: 'Running', durationMin: 45, isOutdoor: true, feel: 4 },
    { dayEntryId: day1, type: 'Weights', durationMin: 50, isOutdoor: false },
    { dayEntryId: day2, type: 'Running', durationMin: 50, isOutdoor: true, feel: 5 },
  ] as Workout[])
  return challengeId
}

describe('WorkoutsSection', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  beforeEach(freshDatabase)

  it('adds up the attempt, with every card closed', async () => {
    render(<WorkoutsSection challengeId={await seedAttempt()} />)

    expect(await screen.findByRole('button', { name: 'Running, 2 sessions' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: 'Weights, 1 session' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('list', { name: /sessions$/ })).not.toBeInTheDocument()

    const summary = screen.getByRole('list', { name: 'This attempt' })
    expect(summary).toHaveTextContent('3sessions')
    expect(summary).toHaveTextContent('2h 25mof training')
    expect(summary).toHaveTextContent('2outdoors')
  })

  it('opens a card on its sessions, newest first, and how they felt', async () => {
    render(<WorkoutsSection challengeId={await seedAttempt()} />)

    const running = await screen.findByRole('button', { name: 'Running, 2 sessions' })
    fireEvent.click(running)
    expect(running).toHaveAttribute('aria-expanded', 'true')

    const rows = within(screen.getByRole('list', { name: 'Running sessions' })).getAllByRole('listitem')
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Day 2'),
      expect.stringContaining('Day 1'),
    ])
    expect(rows[0]).toHaveTextContent('Thu 1 Oct')
    expect(rows[0]).toHaveTextContent('50 min · Outdoor')
    expect(within(rows[0]).getByRole('img', { name: 'Great' })).toBeInTheDocument()

    const feels = within(screen.getByRole('list', { name: 'How it felt' })).getAllByRole('listitem')
    expect(feels.map((chip) => chip.textContent)).toEqual([expect.stringContaining('Great: 1'), expect.stringContaining('Good: 1')])
  })

  it('opens one card at a time, and closes the open one when tapped', async () => {
    render(<WorkoutsSection challengeId={await seedAttempt()} />)

    const running = await screen.findByRole('button', { name: 'Running, 2 sessions' })
    const weights = screen.getByRole('button', { name: 'Weights, 1 session' })
    fireEvent.click(running)
    fireEvent.click(weights)
    expect(weights).toHaveAttribute('aria-expanded', 'true')
    expect(running).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(weights)
    expect(weights).toHaveAttribute('aria-expanded', 'false')
    // The folding panel leaves the page a tick after the tap.
    await waitFor(() => expect(screen.queryByRole('list', { name: /sessions$/ })).not.toBeInTheDocument())
  })

  it('lists the activities not tried yet', async () => {
    render(<WorkoutsSection challengeId={await seedAttempt()} />)

    const untried = await screen.findByRole('list', { name: 'Not tried yet' })
    expect(within(untried).getAllByRole('listitem').map((chip) => chip.textContent)).toEqual([
      'Walking',
      'Yoga',
      'Cycling',
      'Swimming',
      'Other',
    ])
  })

  it('with no workouts yet, says so', async () => {
    const challengeId = await addChallenge({ startDate: START, attemptNumber: 1, status: 'active' })
    render(<WorkoutsSection challengeId={challengeId} />)

    expect(await screen.findByRole('heading', { name: 'No workouts yet' })).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Not tried yet' })).getAllByRole('listitem')).toHaveLength(7)
  })
})

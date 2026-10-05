import { fireEvent, render, screen } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../../db/db'
import { addChallenge, freshDatabase } from '../../../db/__tests__/fixtures'
import { todayISO } from '../../../lib/dates'
import { StatsScreen } from '../StatsScreen'

async function renderStats() {
  const challengeId = await addChallenge({ startDate: todayISO(), attemptNumber: 1, status: 'active' })
  const challenge = (await db.challenges.get(challengeId))!
  render(<StatsScreen challenge={challenge} streak={0} today={todayISO()} todayDayNumber={1} completed={false} />)
}

describe('StatsScreen', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  beforeEach(freshDatabase)

  it('keeps Weight folded until it is opened', async () => {
    await renderStats()

    const weight = screen.getByRole('button', { name: 'Weight' })
    expect(weight).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText(/No weigh-ins yet/)).not.toBeInTheDocument()

    fireEvent.click(weight)
    expect(weight).toHaveAttribute('aria-expanded', 'true')
    expect(await screen.findByText(/No weigh-ins yet/)).toBeInTheDocument()
  })

  it('shows the workouts right under Weight', async () => {
    await renderStats()

    const weight = screen.getByRole('heading', { name: 'Weight' })
    const workouts = await screen.findByRole('heading', { name: 'Workouts' })
    expect(weight.compareDocumentPosition(workouts) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(await screen.findByRole('heading', { name: 'No workouts yet' })).toBeInTheDocument()
  })

  it('keeps only the water and pages tiles', async () => {
    await renderStats()

    expect(screen.getByText('Water drunk')).toBeInTheDocument()
    expect(screen.getByText('Pages read')).toBeInTheDocument()
    for (const gone of ['Training', 'Current streak', 'Perfect days']) {
      expect(screen.queryByText(gone), gone).not.toBeInTheDocument()
    }
  })
})

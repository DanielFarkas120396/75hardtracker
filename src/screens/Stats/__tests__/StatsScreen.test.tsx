import { fireEvent, render, screen } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../../db/db'
import { addChallenge, freshDatabase } from '../../../db/__tests__/fixtures'
import { todayISO } from '../../../lib/dates'
import { StatsScreen } from '../StatsScreen'

describe('StatsScreen', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
    window.scrollTo = vi.fn()
  })

  beforeEach(freshDatabase)

  it('opens the Workouts page from the Training tile, and comes back', async () => {
    const challengeId = await addChallenge({ startDate: todayISO(), attemptNumber: 1, status: 'active' })
    const challenge = (await db.challenges.get(challengeId))!
    render(<StatsScreen challenge={challenge} streak={0} today={todayISO()} todayDayNumber={1} completed={false} />)

    fireEvent.click(screen.getByRole('button', { name: /Training/ }))
    expect(await screen.findByRole('heading', { name: 'Workouts' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Stats' }))
    expect(await screen.findByRole('heading', { name: 'Stats' })).toBeInTheDocument()
  })
})

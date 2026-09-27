import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../../db/db'
import { addChallenge, freshDatabase } from '../../../db/__tests__/fixtures'
import type { Challenge } from '../../../db/types'
import { addDaysISO, todayISO } from '../../../lib/dates'
import { PreStartView } from '../PreStartView'

describe('PreStartView', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  beforeEach(freshDatabase)

  it('names the chosen challenge, and plans Day 1 as a social occasion through the sheet', async () => {
    const today = todayISO()
    const startDate = addDaysISO(today, 3) // Day 1 starts in 3 days
    const challengeId = await addChallenge({ startDate, attemptNumber: 1, status: 'active', variant: 'medium' })
    const challenge = (await db.challenges.get(challengeId)) as Challenge
    const todayDayNumber = -2

    render(<PreStartView challenge={challenge} todayDayNumber={todayDayNumber} today={today} />)

    expect(screen.getByText('75 Medium · Attempt #1')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '🥂 Plan a social occasion' }))

    fireEvent.change(screen.getByLabelText('Day'), { target: { value: startDate } })
    fireEvent.click(screen.getByRole('button', { name: 'Declare' }))

    await waitFor(async () => expect((await db.challenges.get(challengeId))?.socialDays).toEqual([1]))
  })

  it('offers no social button for a Hard challenge', async () => {
    const today = todayISO()
    const startDate = addDaysISO(today, 3)
    const challengeId = await addChallenge({ startDate, attemptNumber: 1, status: 'active', variant: 'hard' })
    const challenge = (await db.challenges.get(challengeId)) as Challenge

    render(<PreStartView challenge={challenge} todayDayNumber={-2} today={today} />)

    expect(screen.getByText('75 Hard · Attempt #1')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '🥂 Plan a social occasion' })).not.toBeInTheDocument()
  })
})

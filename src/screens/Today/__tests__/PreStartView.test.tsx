import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../../db/db'
import { addChallenge, freshDatabase, TEST_PROFILE } from '../../../db/__tests__/fixtures'
import type { Challenge } from '../../../db/types'
import { ProfileContext } from '../../../hooks/useProfile'
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

    expect(screen.getByText('75 Medium #1')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '🥂 Plan a social occasion' }))

    fireEvent.change(screen.getByLabelText('Day'), { target: { value: startDate } })
    fireEvent.click(screen.getByRole('button', { name: 'Declare' }))

    await waitFor(async () => expect((await db.challenges.get(challengeId))?.socialDays).toEqual([1]))
  })

  it('lets the player add the book they will read, before Day 1', async () => {
    const today = todayISO()
    const challengeId = await addChallenge({ startDate: addDaysISO(today, 3), attemptNumber: 1, status: 'active' })
    const challenge = (await db.challenges.get(challengeId)) as Challenge

    render(<PreStartView challenge={challenge} todayDayNumber={-2} today={today} />)

    const book = screen.getByRole('region', { name: 'Your book' })
    expect(book).toHaveTextContent('No books yet')
    fireEvent.click(screen.getByRole('button', { name: '+ Add book' }))
    fireEvent.change(screen.getByPlaceholderText('Book title'), { target: { value: 'Atomic Habits' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(async () => expect(await db.books.toArray()).toMatchObject([{ title: 'Atomic Habits' }]))
  })

  it('offers no social button for a Hard challenge', async () => {
    const today = todayISO()
    const startDate = addDaysISO(today, 3)
    const challengeId = await addChallenge({ startDate, attemptNumber: 1, status: 'active', variant: 'hard' })
    const challenge = (await db.challenges.get(challengeId)) as Challenge

    render(<PreStartView challenge={challenge} todayDayNumber={-2} today={today} />)

    expect(screen.getByText('75 Hard #1')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '🥂 Plan a social occasion' })).not.toBeInTheDocument()
  })

  it('greets the player by name and quotes their reason before Day 1 too', async () => {
    const today = todayISO()
    const challengeId = await addChallenge({ startDate: addDaysISO(today, 3), attemptNumber: 1, status: 'active' })
    const challenge = (await db.challenges.get(challengeId)) as Challenge

    render(
      <ProfileContext.Provider value={TEST_PROFILE}>
        <PreStartView challenge={challenge} todayDayNumber={-2} today={today} />
      </ProfileContext.Provider>,
    )

    expect(screen.getByText('Hey Daniel')).toBeInTheDocument()
    expect(screen.getByText('“A fresh start”')).toBeInTheDocument()
  })
})

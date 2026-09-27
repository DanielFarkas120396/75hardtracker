import { fireEvent, render, screen, within } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { addChallenge, freshDatabase } from '../../../db/__tests__/fixtures'
import { addDaysISO, formatDisplayDate, todayISO } from '../../../lib/dates'
import { AttemptHistorySection } from '../AttemptHistorySection'

describe('AttemptHistorySection', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  beforeEach(freshDatabase)

  it('lists a given-up attempt as abandoned, and marks the day it ended instead of calling it missed', async () => {
    const today = todayISO()
    // Given up today, on Day 3, with nothing logged: Days 1 and 2 were missed.
    await addChallenge({
      startDate: addDaysISO(today, -2),
      attemptNumber: 1,
      status: 'abandoned',
      variant: 'hard',
      abandonedOn: today,
    })
    render(<AttemptHistorySection today={today} />)

    const attempt = await screen.findByRole('button', { name: /Attempt #1 · Reached Day 3/ })
    expect(within(attempt).getByText('abandoned')).toBeInTheDocument()

    fireEvent.click(attempt)

    expect(await screen.findByText(`· ${formatDisplayDate(today)} · gave up`)).toBeInTheDocument()
    expect(screen.getAllByText(/· missed /)).toHaveLength(2)
  })
})

import { render, screen } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../../db/db'
import { addChallenge, freshDatabase, TEST_PROFILE } from '../../../db/__tests__/fixtures'
import type { Challenge } from '../../../db/types'
import { ProfileContext } from '../../../hooks/useProfile'
import { addDaysISO, todayISO } from '../../../lib/dates'
import { DayFailedScreen } from '../DayFailedScreen'

describe('DayFailedScreen', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  beforeEach(freshDatabase)

  it('moves focus to its heading, since it replaces the whole app', async () => {
    const today = todayISO()
    // A 75 Hard attempt that started 3 days ago with nothing logged: Day 1 failed it.
    const challengeId = await addChallenge({ startDate: addDaysISO(today, -3), attemptNumber: 1, status: 'active' })
    const challenge = (await db.challenges.get(challengeId)) as Challenge
    render(<DayFailedScreen challenge={challenge} failedDayNumber={1} today={today} />)
    // Let the missed-task list load, so nothing updates after the test.
    await screen.findAllByRole('listitem')

    expect(screen.getByRole('heading', { name: "Day 1 wasn't completed" })).toHaveFocus()
    expect(screen.getByText("Again. From Day 1. I'm watching.")).toBeInTheDocument()
    expect(screen.queryByText(/You said/)).not.toBeInTheDocument()
  })

  it("calls the player by name and quotes their reason back", async () => {
    const today = todayISO()
    const challengeId = await addChallenge({ startDate: addDaysISO(today, -3), attemptNumber: 1, status: 'active' })
    const challenge = (await db.challenges.get(challengeId)) as Challenge
    render(
      <ProfileContext.Provider value={TEST_PROFILE}>
        <DayFailedScreen challenge={challenge} failedDayNumber={1} today={today} />
      </ProfileContext.Provider>,
    )
    // Let the missed-task list load, so nothing updates after the test.
    await screen.findAllByRole('listitem')

    expect(screen.getByText("Again, Daniel. From Day 1. I'm watching.")).toBeInTheDocument()
    expect(screen.getByText('You said: “A fresh start”')).toBeInTheDocument()
  })
})

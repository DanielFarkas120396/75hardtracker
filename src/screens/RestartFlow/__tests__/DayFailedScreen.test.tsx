import { render, screen } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../../db/db'
import { addChallenge, freshDatabase } from '../../../db/__tests__/fixtures'
import type { Challenge } from '../../../db/types'
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
  })
})

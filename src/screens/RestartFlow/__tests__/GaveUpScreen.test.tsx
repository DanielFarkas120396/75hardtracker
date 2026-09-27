import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../../db/db'
import { addChallenge, freshDatabase } from '../../../db/__tests__/fixtures'
import type { Challenge } from '../../../db/types'
import { addDaysISO, todayISO } from '../../../lib/dates'
import { GaveUpScreen } from '../GaveUpScreen'

const today = todayISO()

/** A 75 Medium attempt #2 that started 11 days ago and was given up (today, on Day 12, unless no date is given). */
async function setup(abandonedOn: string | undefined) {
  const challengeId = await addChallenge({
    startDate: addDaysISO(today, -11),
    attemptNumber: 2,
    status: 'abandoned',
    variant: 'medium',
    ...(abandonedOn ? { abandonedOn } : {}),
  })
  const challenge = (await db.challenges.get(challengeId)) as Challenge
  render(<GaveUpScreen challenge={challenge} today={today} />)
}

describe('GaveUpScreen', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  beforeEach(freshDatabase)

  it('names the day, the challenge and the attempt', async () => {
    await setup(today)

    expect(screen.getByRole('heading', { name: 'You gave up on Day 12' })).toBeInTheDocument()
    expect(screen.getByText('75 Medium, attempt #2. It stays in your history.')).toBeInTheDocument()
    expect(screen.getByText("Fine. Pick something. I'm still watching.")).toBeInTheDocument()
  })

  it('says only "You gave up" when the give-up date is missing', async () => {
    await setup(undefined)

    expect(screen.getByRole('heading', { name: 'You gave up' })).toBeInTheDocument()
  })

  it('starts the next attempt from the sheet, with the same challenge picked by default', async () => {
    await setup(today)

    fireEvent.click(screen.getByRole('button', { name: 'Start a new challenge' }))
    expect(await screen.findByRole('heading', { name: 'Start a new challenge' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /^75 Medium/ })).toHaveAttribute('aria-checked', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Start' }))

    await waitFor(async () =>
      expect(await db.challenges.where('status').equals('active').toArray()).toMatchObject([
        { attemptNumber: 3, variant: 'medium', startDate: today },
      ]),
    )
  })
})

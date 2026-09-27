import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../../db/db'
import { addChallenge, freshDatabase } from '../../../db/__tests__/fixtures'
import type { Challenge } from '../../../db/types'
import { addDaysISO, todayISO } from '../../../lib/dates'
import type { ChallengeVariant } from '../../../logic/rulesets'
import { StartDateSection } from '../StartDateSection'

/** An active challenge whose Day 1 is `todayDayNumber` days before today. */
async function setup(todayDayNumber: number, variant?: ChallengeVariant) {
  const today = todayISO()
  const startDate = addDaysISO(today, -(todayDayNumber - 1))
  const challengeId = await addChallenge({
    startDate,
    attemptNumber: 1,
    status: 'active',
    ...(variant ? { variant } : {}),
  })
  const challenge = (await db.challenges.get(challengeId)) as Challenge
  render(<StartDateSection challenge={challenge} today={today} todayDayNumber={todayDayNumber} />)
  return { challengeId }
}

describe('StartDateSection', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  beforeEach(freshDatabase)

  it('shows the Challenge heading on Day 1 and stores the picked variant', async () => {
    const { challengeId } = await setup(1)

    expect(screen.getByRole('heading', { name: 'Challenge' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: /^75 Medium/ }))

    await waitFor(async () => expect((await db.challenges.get(challengeId))?.variant).toBe('medium'))
  })

  it('hides the picker and locks the variant past Day 1', async () => {
    await setup(3)

    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
    expect(screen.getByText('75 Hard — locked for this attempt.')).toBeInTheDocument()
  })
})

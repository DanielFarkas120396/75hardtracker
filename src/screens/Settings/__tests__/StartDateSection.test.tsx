import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../../db/db'
import { addChallenge, freshDatabase } from '../../../db/__tests__/fixtures'
import type { Challenge } from '../../../db/types'
import { addDaysISO, formatShortDay, todayISO } from '../../../lib/dates'
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

/** The paragraph whose text contains `text` (the date makes it awkward to match as a regex). */
const paragraphWith = (text: string) =>
  screen.getByText((_, el) => el?.tagName === 'P' && (el.textContent ?? '').includes(text))

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

  it('says on Day 1 that the challenge locks at midnight tonight', async () => {
    await setup(1)

    expect(screen.getByText(/until midnight tonight, the end of Day 1\. After that, both are locked/)).toBeInTheDocument()
  })

  it('names the Day 1 date as the deadline before the attempt starts', async () => {
    await setup(-2) // starts in 3 days

    expect(paragraphWith(`until the end of Day 1 (${formatShortDay(addDaysISO(todayISO(), 3))})`)).toBeInTheDocument()
  })

  it('hides the picker past Day 1, says when it locked and how to switch anyway', async () => {
    await setup(3)

    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
    expect(screen.getByText('🔒 75 Hard — locked for this attempt.')).toBeInTheDocument()
    expect(paragraphWith(`until the end of Day 1 (${formatShortDay(addDaysISO(todayISO(), -2))})`)).toHaveTextContent(
      'give up this attempt (Danger zone, below) and start a new one',
    )
  })
})

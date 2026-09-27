import { render, screen } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../../db/db'
import { addChallenge, freshDatabase } from '../../../db/__tests__/fixtures'
import type { Challenge } from '../../../db/types'
import { todayISO } from '../../../lib/dates'
import type { ChallengeVariant } from '../../../logic/rulesets'
import { VictoryScreen } from '../VictoryScreen'

/** A completed attempt of the given variant, rendered with the gate's streak and missedDays. */
async function setup(props: { variant: ChallengeVariant; streak: number; missedDays: number[] }) {
  const challengeId = await addChallenge({
    startDate: todayISO(),
    attemptNumber: 1,
    status: 'completed',
    variant: props.variant,
  })
  const challenge = (await db.challenges.get(challengeId)) as Challenge
  render(
    <VictoryScreen
      challenge={challenge}
      today={todayISO()}
      revealed={false}
      streak={props.streak}
      missedDays={props.missedDays}
    />,
  )
}

describe('VictoryScreen', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  beforeEach(freshDatabase)

  it('shows the variant title, the streak and a Jokers used stat for a completed Medium challenge', async () => {
    await setup({ variant: 'medium', streak: 42, missedDays: [12] })

    expect(await screen.findByRole('heading', { name: '75 Medium complete! 🏆' })).toBeInTheDocument()
    expect(screen.getByText('🔥 42')).toBeInTheDocument()
    expect(screen.getByText('Jokers used')).toBeInTheDocument()
    expect(screen.getByText('1/1')).toBeInTheDocument()
  })

  it('shows no Jokers used stat for a Hard victory', async () => {
    await setup({ variant: 'hard', streak: 75, missedDays: [] })

    expect(await screen.findByRole('heading', { name: '75 Hard complete! 🏆' })).toBeInTheDocument()
    expect(screen.queryByText('Jokers used')).not.toBeInTheDocument()
  })
})

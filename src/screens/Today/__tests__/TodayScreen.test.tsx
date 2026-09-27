import { render, screen } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../../db/db'
import { addChallenge, freshDatabase } from '../../../db/__tests__/fixtures'
import { dayEntryRepo } from '../../../db/repositories/dayEntryRepo'
import type { Challenge } from '../../../db/types'
import { addDaysISO, todayISO } from '../../../lib/dates'
import type { ChallengeVariant } from '../../../logic/rulesets'
import { TodayScreen } from '../TodayScreen'

/** Seeds an active challenge and today's entry, then renders TodayScreen with the props App passes. */
async function setup({
  variant = 'hard' as ChallengeVariant,
  todayDayNumber = 3,
  jokersLeft = 0,
  socialDays,
}: {
  variant?: ChallengeVariant
  todayDayNumber?: number
  jokersLeft?: number
  socialDays?: number[]
} = {}) {
  const today = todayISO()
  const startDate = addDaysISO(today, -(todayDayNumber - 1))
  const challengeId = await addChallenge({
    startDate,
    attemptNumber: 1,
    status: 'active',
    variant,
    ...(socialDays ? { socialDays } : {}),
  })
  const challenge = (await db.challenges.get(challengeId)) as Challenge
  await dayEntryRepo.getOrCreate({ challengeId, dayNumber: todayDayNumber, date: today })
  const dayEntries = await dayEntryRepo.getAllForChallenge(challengeId)

  render(
    <TodayScreen
      challenge={challenge}
      dayEntries={dayEntries}
      today={today}
      todayDayNumber={todayDayNumber}
      streak={0}
      jokersLeft={jokersLeft}
    />,
  )
  return { challenge, today }
}

describe('TodayScreen', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  beforeEach(freshDatabase)

  it("ignores a stray socialDays entry on a Hard row: keeps the alcohol toggle instead of the drink-allowed line", async () => {
    await setup({ variant: 'hard', todayDayNumber: 3, socialDays: [3] })

    expect(await screen.findByRole('switch', { name: 'No alcohol' })).toBeInTheDocument()
    expect(screen.queryByText('🥂 Social occasion today — a drink is allowed.')).not.toBeInTheDocument()
  })
})

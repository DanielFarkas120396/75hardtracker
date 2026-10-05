import { render, screen } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { addChallenge, freshDatabase } from '../../../db/__tests__/fixtures'
import { dayEntryRepo } from '../../../db/repositories/dayEntryRepo'
import { todayISO } from '../../../lib/dates'
import { RULESETS } from '../../../logic/rulesets'
import { WaterTask } from '../WaterTask'

describe('WaterTask', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  beforeEach(freshDatabase)

  it("shows Medium's 3 L target without a trailing .0", async () => {
    const challengeId = await addChallenge({ startDate: todayISO(), attemptNumber: 1, status: 'active', variant: 'medium' })
    const entry = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 1, date: todayISO() })

    render(<WaterTask entry={entry} rules={RULESETS.medium} />)

    expect(screen.getByText('of 3 L')).toBeInTheDocument()
  })
})

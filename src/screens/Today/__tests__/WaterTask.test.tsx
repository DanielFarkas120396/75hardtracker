import { fireEvent, render, screen } from '@testing-library/react'
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

  it('can take a pour back, but never below empty', async () => {
    const challengeId = await addChallenge({ startDate: todayISO(), attemptNumber: 1, status: 'active' })
    const entry = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 1, date: todayISO() })
    await dayEntryRepo.adjustWater(entry.id, 500)
    const poured = (await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 1, date: todayISO() })) ?? entry

    render(<WaterTask entry={poured} rules={RULESETS.hard} />)
    expect(screen.getByRole('button', { name: '− 250 ml' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: '− 250 ml' }))
    expect((await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 1, date: todayISO() })).water_ml).toBe(250)

    render(<WaterTask entry={entry} rules={RULESETS.hard} />)
    expect(screen.getAllByRole('button', { name: '− 250 ml' })[1]).toBeDisabled()
  })
})

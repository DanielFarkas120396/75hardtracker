import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../../db/db'
import { addChallenge, freshDatabase } from '../../../db/__tests__/fixtures'
import { dayEntryRepo } from '../../../db/repositories/dayEntryRepo'
import { todayISO } from '../../../lib/dates'
import { RULESETS } from '../../../logic/rulesets'
import { WorkoutCard } from '../WorkoutCard'

describe('WorkoutCard', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  beforeEach(freshDatabase)

  it('Hard: has no recovery-day button', async () => {
    const challengeId = await addChallenge({ startDate: todayISO(), attemptNumber: 1, status: 'active' })
    const entry = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 1, date: todayISO() })

    render(
      <WorkoutCard dayEntryId={entry.id} workouts={[]} complete={false} cheer="" rules={RULESETS.hard} restDay={false} />,
    )

    expect(screen.queryByRole('button', { name: 'Take my recovery day' })).not.toBeInTheDocument()
  })

  it('Soft: taking the recovery day stores it', async () => {
    const challengeId = await addChallenge({ startDate: todayISO(), attemptNumber: 1, status: 'active', variant: 'soft' })
    const entry = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 1, date: todayISO() })

    render(
      <WorkoutCard dayEntryId={entry.id} workouts={[]} complete={false} cheer="" rules={RULESETS.soft} restDay={false} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Take my recovery day' }))

    await waitFor(async () => expect((await db.dayEntries.get(entry.id))?.restDay).toBe(true))
  })

  it('Soft, week already taken: names the day that used it', async () => {
    const challengeId = await addChallenge({ startDate: todayISO(), attemptNumber: 1, status: 'active', variant: 'soft' })
    const day2 = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 2, date: todayISO() })
    await dayEntryRepo.setRestDay(day2.id, true)
    const day3 = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 3, date: todayISO() })

    render(
      <WorkoutCard dayEntryId={day3.id} workouts={[]} complete={false} cheer="" rules={RULESETS.soft} restDay={false} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Take my recovery day' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("Day 2 was this week's recovery day.")
  })

  it('Soft, already taken: shows the pill and undoing it clears the stored field', async () => {
    const challengeId = await addChallenge({ startDate: todayISO(), attemptNumber: 1, status: 'active', variant: 'soft' })
    const entry = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 1, date: todayISO() })
    await dayEntryRepo.setRestDay(entry.id, true)

    render(<WorkoutCard dayEntryId={entry.id} workouts={[]} complete={false} cheer="" rules={RULESETS.soft} restDay />)

    expect(screen.getByText('Recovery day ✓')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))

    await waitFor(async () => expect((await db.dayEntries.get(entry.id))?.restDay).toBeUndefined())
  })
})

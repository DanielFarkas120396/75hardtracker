import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../../db/db'
import { addChallenge, freshDatabase } from '../../../db/__tests__/fixtures'
import { dayEntryRepo } from '../../../db/repositories/dayEntryRepo'
import { todayISO } from '../../../lib/dates'
import { RULESETS } from '../../../logic/rulesets'
import { WorkoutTask } from '../WorkoutTask'

describe('WorkoutTask', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  beforeEach(freshDatabase)

  it('Hard: has no recovery-day button', async () => {
    const challengeId = await addChallenge({ startDate: todayISO(), attemptNumber: 1, status: 'active' })
    const entry = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 1, date: todayISO() })

    render(
      <WorkoutTask
        dayEntryId={entry.id}
        workouts={[]}
        complete={false}
        rules={RULESETS.hard}
        restDay={false}
        weekRestDay={undefined}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Take my recovery day' })).not.toBeInTheDocument()
  })

  it('Soft: taking the recovery day stores it', async () => {
    const challengeId = await addChallenge({ startDate: todayISO(), attemptNumber: 1, status: 'active', variant: 'soft' })
    const entry = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 1, date: todayISO() })

    render(
      <WorkoutTask
        dayEntryId={entry.id}
        workouts={[]}
        complete={false}
        rules={RULESETS.soft}
        restDay={false}
        weekRestDay={undefined}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Take my recovery day' }))

    await waitFor(async () => expect((await db.dayEntries.get(entry.id))?.restDay).toBe(true))
  })

  it('Soft, week already taken (stale prop): the button still shows, and the repo rejection is the fallback alert', async () => {
    const challengeId = await addChallenge({ startDate: todayISO(), attemptNumber: 1, status: 'active', variant: 'soft' })
    const day2 = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 2, date: todayISO() })
    await dayEntryRepo.setRestDay(day2.id, true)
    const day3 = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 3, date: todayISO() })

    render(
      <WorkoutTask
        dayEntryId={day3.id}
        workouts={[]}
        complete={false}
        rules={RULESETS.soft}
        restDay={false}
        weekRestDay={undefined}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Take my recovery day' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("Day 2 was this week's recovery day.")
  })

  it('Soft, already taken: shows the pill and undoing it clears the stored field', async () => {
    const challengeId = await addChallenge({ startDate: todayISO(), attemptNumber: 1, status: 'active', variant: 'soft' })
    const entry = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 1, date: todayISO() })
    await dayEntryRepo.setRestDay(entry.id, true)

    render(
      <WorkoutTask
        dayEntryId={entry.id}
        workouts={[]}
        complete={false}
        rules={RULESETS.soft}
        restDay
        weekRestDay={undefined}
      />,
    )

    expect(screen.getByText('Recovery day ✓')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))

    await waitFor(async () => expect((await db.dayEntries.get(entry.id))?.restDay).toBeUndefined())
  })

  it("Soft, this week's recovery day was taken elsewhere: shows the note instead of a button", async () => {
    const challengeId = await addChallenge({ startDate: todayISO(), attemptNumber: 1, status: 'active', variant: 'soft' })
    const entry = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 3, date: todayISO() })

    render(
      <WorkoutTask
        dayEntryId={entry.id}
        workouts={[]}
        complete={false}
        rules={RULESETS.soft}
        restDay={false}
        weekRestDay={2}
      />,
    )

    expect(screen.getByText("Day 2 was this week's recovery day.")).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Take my recovery day' })).not.toBeInTheDocument()
  })

  it('Soft, workouts already complete: offers no recovery-day control at all', async () => {
    const challengeId = await addChallenge({ startDate: todayISO(), attemptNumber: 1, status: 'active', variant: 'soft' })
    const entry = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 1, date: todayISO() })

    render(
      <WorkoutTask
        dayEntryId={entry.id}
        workouts={[]}
        complete
        rules={RULESETS.soft}
        restDay={false}
        weekRestDay={undefined}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Take my recovery day' })).not.toBeInTheDocument()
    expect(screen.queryByText(/was this week's recovery day/)).not.toBeInTheDocument()
    expect(screen.queryByText('Recovery day ✓')).not.toBeInTheDocument()
  })
})

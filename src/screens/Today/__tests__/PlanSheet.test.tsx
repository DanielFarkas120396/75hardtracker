import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../../db/db'
import { addChallenge, freshDatabase } from '../../../db/__tests__/fixtures'
import { dayEntryRepo } from '../../../db/repositories/dayEntryRepo'
import { todayISO } from '../../../lib/dates'
import { MIN_WORKOUT_MIN, WATER_TARGET_ML } from '../../../logic/constants'
import type { DayTaskData } from '../../../logic/types'
import { PlanSheet } from '../PlanSheet'

/** Everything done but the reading and the photo. */
const DATA: DayTaskData = {
  water_ml: WATER_TARGET_ML,
  pages_read: 0,
  dietFollowed: true,
  noAlcohol: true,
  hasPhoto: false,
  workouts: [
    { durationMin: MIN_WORKOUT_MIN, isOutdoor: true },
    { durationMin: MIN_WORKOUT_MIN, isOutdoor: false },
  ],
}

async function setup({ nowMin = 20 * 60, plans }: { nowMin?: number; plans?: Record<string, string> } = {}) {
  const challengeId = await addChallenge({ startDate: todayISO(), attemptNumber: 1, status: 'active' })
  const created = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 1, date: todayISO() })
  if (plans) await dayEntryRepo.setPlans(created.id, plans)
  const entry = (await db.dayEntries.get(created.id))!
  const onSaved = vi.fn()
  render(
    <PlanSheet open entry={entry} data={DATA} missing={['reading', 'photo']} nowMin={nowMin} onClose={vi.fn()} onSaved={onSaved} />,
  )
  return { entry, onSaved }
}

describe('PlanSheet', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  beforeEach(freshDatabase)

  it('saves a time for a task and reports the earliest plan', async () => {
    const { entry, onSaved } = await setup()
    fireEvent.change(screen.getByLabelText('Reading'), { target: { value: '22:30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save plan' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(22 * 60 + 30))
    expect((await db.dayEntries.get(entry.id))?.plans).toEqual({ reading: '22:30' })
  })

  it('refuses a time that has passed', async () => {
    await setup({ nowMin: 21 * 60 })
    fireEvent.change(screen.getByLabelText('Reading'), { target: { value: '20:00' } })
    expect(screen.getByText('Pick a time later than now.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save plan' })).toBeDisabled()
  })

  it('refuses a task that would run past midnight', async () => {
    await setup()
    fireEvent.change(screen.getByLabelText('Reading'), { target: { value: '23:50' } })
    expect(screen.getByText("That won't fit before midnight.")).toBeInTheDocument()
  })

  it('keeps an earlier plan whose time has passed without blocking the save', async () => {
    const { entry, onSaved } = await setup({ plans: { photo: '19:00' } })
    fireEvent.change(screen.getByLabelText('Reading'), { target: { value: '22:30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save plan' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(19 * 60))
    expect((await db.dayEntries.get(entry.id))?.plans).toEqual({ reading: '22:30', photo: '19:00' })
  })

  it('clears a planned time', async () => {
    const { entry } = await setup({ plans: { reading: '22:30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Clear Reading' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save plan' }))
    await waitFor(async () => expect(await db.dayEntries.get(entry.id)).not.toHaveProperty('plans'))
  })
})

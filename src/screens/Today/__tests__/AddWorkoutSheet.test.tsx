import { fireEvent, render, screen } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { addChallenge, freshDatabase } from '../../../db/__tests__/fixtures'
import { dayEntryRepo } from '../../../db/repositories/dayEntryRepo'
import { workoutRepo } from '../../../db/repositories/workoutRepo'
import { todayISO } from '../../../lib/dates'
import { RULESETS, type Ruleset } from '../../../logic/rulesets'
import { AddWorkoutSheet } from '../AddWorkoutSheet'

async function today(logged: { isOutdoor: boolean }[] = []) {
  const challengeId = await addChallenge({ startDate: todayISO(), attemptNumber: 1, status: 'active' })
  const entry = await dayEntryRepo.getOrCreate({ challengeId, dayNumber: 1, date: todayISO() })
  for (const { isOutdoor } of logged) await workoutRepo.add({ dayEntryId: entry.id, type: 'Weights', durationMin: 45, isOutdoor })
  return entry.id
}

const sheet = (dayEntryId: number, rules: Ruleset = RULESETS.hard) =>
  render(<AddWorkoutSheet open dayEntryId={dayEntryId} rules={rules} onClose={vi.fn()} />)

const outdoor = () => screen.getByRole('switch', { name: 'Outdoor' })

describe('AddWorkoutSheet', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  beforeEach(freshDatabase)

  it('on Hard, says one must be outdoors and starts a run outdoors; a gym session starts indoors', async () => {
    sheet(await today())
    expect(await screen.findByText("One of today's workouts must be outdoors.")).toBeInTheDocument()
    expect(outdoor()).toHaveAttribute('aria-checked', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Weights' }))
    expect(outdoor()).toHaveAttribute('aria-checked', 'false')
  })

  it('after one indoor session, says this one must be outdoors', async () => {
    sheet(await today([{ isOutdoor: false }]))
    expect(await screen.findByText('This one must be outdoors.')).toBeInTheDocument()
  })

  it('a hand-set Outdoor stays as set when the activity changes', async () => {
    sheet(await today())
    await screen.findByText("One of today's workouts must be outdoors.")
    fireEvent.click(outdoor())
    fireEvent.click(screen.getByRole('button', { name: 'Cycling' }))
    expect(outdoor()).toHaveAttribute('aria-checked', 'false')
  })

  it('says nothing once the outdoor session is logged, or on a challenge without the rule', async () => {
    const { unmount } = sheet(await today([{ isOutdoor: true }]))
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(screen.queryByText(/must be outdoors/)).not.toBeInTheDocument()
    expect(outdoor()).toHaveAttribute('aria-checked', 'false')
    unmount()

    await freshDatabase()
    sheet(await today(), RULESETS.medium)
    expect(screen.queryByText(/must be outdoors/)).not.toBeInTheDocument()
    expect(outdoor()).toHaveAttribute('aria-checked', 'false')
  })
})

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../../db/db'
import { addChallenge, freshDatabase } from '../../../db/__tests__/fixtures'
import { challengeRepo } from '../../../db/repositories/challengeRepo'
import { addDaysISO, todayISO } from '../../../lib/dates'
import type { ChallengeVariant } from '../../../logic/rulesets'
import { NewChallengeSheet } from '../NewChallengeSheet'

/** A completed attempt, so `startNew` always creates a fresh active one instead of reusing it. */
async function setup(defaultVariant: ChallengeVariant = 'hard') {
  const today = todayISO()
  await addChallenge({
    startDate: addDaysISO(today, -80),
    attemptNumber: 1,
    status: 'completed',
    variant: 'hard',
  })
  const onClose = vi.fn()
  render(<NewChallengeSheet open onClose={onClose} defaultVariant={defaultVariant} today={today} />)
  return { today, onClose }
}

describe('NewChallengeSheet', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  beforeEach(freshDatabase)

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the title and defaults the picker to defaultVariant', async () => {
    await setup('medium')

    expect(screen.getByRole('heading', { name: 'Start a new challenge' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /^75 Medium/ })).toHaveAttribute('aria-checked', 'true')
  })

  it('offers Today, Tomorrow and a date picker with min = today', async () => {
    const { today } = await setup()

    expect(screen.getByRole('radio', { name: 'Today' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Tomorrow' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: 'Pick a date' }))

    expect(screen.getByLabelText('Start date')).toHaveAttribute('min', today)
  })

  it('starts a new attempt with the chosen variant and date, then closes', async () => {
    const { today, onClose } = await setup('hard')

    fireEvent.click(screen.getByRole('radio', { name: /^75 Soft/ }))
    fireEvent.click(screen.getByRole('radio', { name: 'Tomorrow' }))
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    const created = await db.challenges.where('status').equals('active').first()
    expect(created?.variant).toBe('soft')
    expect(created?.startDate).toBe(addDaysISO(today, 1))
  })

  it('shows an error and stays open when starting fails', async () => {
    vi.spyOn(challengeRepo, 'startNew').mockRejectedValueOnce(new Error('quota'))
    const { onClose } = await setup()

    fireEvent.click(screen.getByRole('button', { name: 'Start' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't start it — try again.")
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Start' })).toBeEnabled()
  })

  it('clearing the picked date shows "Pick a start date." and disables Start', async () => {
    await setup()

    fireEvent.click(screen.getByRole('radio', { name: 'Pick a date' }))
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '' } })

    expect(await screen.findByRole('alert')).toHaveTextContent('Pick a start date.')
    expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled()
    expect(screen.queryByText(/A new attempt starts on/)).not.toBeInTheDocument()
  })

  it('picking a past date shows "The start can\'t be in the past." and disables Start', async () => {
    const { today } = await setup()

    fireEvent.click(screen.getByRole('radio', { name: 'Pick a date' }))
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: addDaysISO(today, -1) } })

    expect(await screen.findByRole('alert')).toHaveTextContent("The start can't be in the past.")
    expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled()
  })

  it('starts the attempt with a valid picked date once one is chosen', async () => {
    const { today, onClose } = await setup()
    const future = addDaysISO(today, 5)

    fireEvent.click(screen.getByRole('radio', { name: 'Pick a date' }))
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: future } })
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    const created = await db.challenges.where('status').equals('active').first()
    expect(created?.startDate).toBe(future)
  })
})

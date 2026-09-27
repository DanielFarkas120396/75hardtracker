import { fireEvent, render, screen } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../../db/db'
import { addChallenge, freshDatabase } from '../../../db/__tests__/fixtures'
import type { Challenge } from '../../../db/types'
import { addDaysISO, todayISO } from '../../../lib/dates'
import { SettingsScreen } from '../SettingsScreen'

// Only the danger zone is under test; the other sections stand aside.
vi.mock('../StartDateSection', () => ({ StartDateSection: () => null }))
vi.mock('../InstallSection', () => ({ InstallSection: () => null }))
vi.mock('../AppearanceSection', () => ({ AppearanceSection: () => null }))
vi.mock('../BooksSection', () => ({ BooksSection: () => null }))
vi.mock('../BadgesSection', () => ({ BadgesSection: () => null }))
vi.mock('../CompanionSection', () => ({ CompanionSection: () => null }))
vi.mock('../ExportImportSection', () => ({ ExportImportSection: () => null }))
vi.mock('../AttemptHistorySection', () => ({ AttemptHistorySection: () => null }))

/** A 75 Hard attempt on Day 12, with Settings open. */
async function setup(canGiveUp: boolean) {
  const today = todayISO()
  const challengeId = await addChallenge({ startDate: addDaysISO(today, -11), attemptNumber: 1, status: 'active' })
  const challenge = (await db.challenges.get(challengeId)) as Challenge
  render(<SettingsScreen challenge={challenge} today={today} todayDayNumber={12} streak={11} canGiveUp={canGiveUp} />)
}

describe('SettingsScreen danger zone', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  beforeEach(freshDatabase)

  it('offers giving up while the attempt can be given up, opening the flow', async () => {
    await setup(true)

    expect(screen.getByText('Stop this attempt for good. It stays in your history.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Give up this challenge' }))

    expect(await screen.findByRole('heading', { name: 'Give up 75 Hard?' })).toBeInTheDocument()
  })

  it('offers only the reset otherwise', async () => {
    await setup(false)

    expect(screen.queryByRole('button', { name: 'Give up this challenge' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reset everything' })).toBeInTheDocument()
  })
})

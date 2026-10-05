import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../../db/db'
import { addChallenge, freshDatabase } from '../../../db/__tests__/fixtures'
import type { Challenge } from '../../../db/types'
import { addDaysISO, todayISO } from '../../../lib/dates'
import { SettingsScreen } from '../SettingsScreen'

// The sections are tested on their own; here they stand aside (Profile leaves a marker).
vi.mock('../StartDateSection', () => ({ StartDateSection: () => null }))
vi.mock('../InstallSection', () => ({ InstallSection: () => null }))
vi.mock('../AppearanceSection', () => ({ AppearanceSection: () => null }))
vi.mock('../BooksSection', () => ({ BooksSection: () => null }))
vi.mock('../BadgesSection', () => ({ BadgesSection: () => null }))
vi.mock('../CompanionSection', () => ({ CompanionSection: () => null }))
vi.mock('../ExportImportSection', () => ({ ExportImportSection: () => null }))
vi.mock('../AttemptHistorySection', () => ({ AttemptHistorySection: () => null }))
vi.mock('../ProfileSection', () => ({ ProfileSection: () => <p>Profile controls</p> }))

afterEach(() => {
  vi.unstubAllGlobals()
})

/** A 75 Hard attempt on Day 12, with Settings open. */
async function setup(canGiveUp: boolean) {
  const today = todayISO()
  const challengeId = await addChallenge({ startDate: addDaysISO(today, -11), attemptNumber: 1, status: 'active' })
  const challenge = (await db.challenges.get(challengeId)) as Challenge
  const view = render(
    <SettingsScreen challenge={challenge} today={today} todayDayNumber={12} streak={11} canGiveUp={canGiveUp} />,
  )
  return { challenge, today, ...view }
}

describe('SettingsScreen list', () => {
  beforeEach(async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }))
    await freshDatabase()
  })

  it('groups the settings into rows that open their own page, and back again', async () => {
    await setup(true)
    for (const group of ['You', 'Challenge', 'App', 'Privacy & data', 'Danger zone']) {
      expect(screen.getByRole('region', { name: group })).toBeInTheDocument()
    }

    fireEvent.click(screen.getByRole('button', { name: /Profile/ }))
    expect(screen.getByRole('heading', { name: 'Profile', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Profile controls')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(screen.getByRole('heading', { name: 'Settings', level: 1 })).toBeInTheDocument()
  })
})

describe('SettingsScreen danger zone', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  beforeEach(async () => {
    // jsdom has no matchMedia (the install row checks for standalone mode).
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }))
    await freshDatabase()
  })

  it('offers giving up while the attempt can be given up, opening the flow', async () => {
    await setup(true)

    expect(screen.getByText(/Giving up stops this attempt for good/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Give up this challenge' }))

    expect(await screen.findByRole('heading', { name: 'Give up 75 Hard?' })).toBeInTheDocument()
  })

  it('offers only the reset otherwise', async () => {
    await setup(false)

    expect(screen.queryByRole('button', { name: 'Give up this challenge' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reset everything' })).toBeInTheDocument()
  })

  it('closes the flow when giving up stops being allowed while it is open', async () => {
    const { challenge, today, rerender } = await setup(true)
    fireEvent.click(screen.getByRole('button', { name: 'Give up this challenge' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()

    rerender(<SettingsScreen challenge={challenge} today={today} todayDayNumber={12} streak={11} canGiveUp={false} />)

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})

import { act, render, screen } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { db } from '../db/db'
import { addChallenge, freshDatabase } from '../db/__tests__/fixtures'
import { resetAll } from '../db/exportImport'
import { profileRepo } from '../db/repositories/profileRepo'
import { todayISO } from '../lib/dates'

describe('App', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
    // useApplyTheme reads this on mount; jsdom has no real implementation.
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    }))
  })

  beforeEach(freshDatabase)

  it('"Reset everything" ends on the welcome flow, never on a bootstrapped attempt', async () => {
    const today = todayISO()
    await addChallenge({ startDate: today, attemptNumber: 1, status: 'active' })
    await profileRepo.completeOnboarding({ name: 'Daniel', why: 'A fresh start' })

    render(<App />)
    await screen.findByText('“A fresh start”', undefined, { timeout: 5000 })

    await act(async () => {
      await resetAll()
    })

    expect(await screen.findByRole('heading', { name: '75 days. 5 tasks. One duck with a knife.' })).toBeInTheDocument()
    // Give a raced bootstrapIfEmpty call (useChallengeGate, still mounted for a moment) a chance to run.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(screen.getByRole('progressbar', { name: 'Welcome progress' })).toHaveAttribute('aria-valuetext', 'Step 1 of 6')
    expect(await db.challenges.count()).toBe(0)
  })
})

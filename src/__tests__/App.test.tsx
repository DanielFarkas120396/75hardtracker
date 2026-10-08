import { act, fireEvent, render, screen } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { db } from '../db/db'
import { addChallenge, freshDatabase } from '../db/__tests__/fixtures'
import { resetAll } from '../db/exportImport'
import { appLockRepo } from '../db/repositories/appLockRepo'
import { profileRepo } from '../db/repositories/profileRepo'
import { todayISO } from '../lib/dates'

// The real PIN hashing, with few rounds so the tests stay fast.
vi.mock('../lib/pin', async (original) => {
  const actual = await original<typeof import('../lib/pin')>()
  return { ...actual, hashPin: (pin: string) => actual.hashPin(pin, 1_000) }
})

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

    // The welcome flow is a lazy chunk: under a loaded test run, it can take more than a second.
    expect(
      await screen.findByRole('heading', { name: '75 days. 5 tasks. One duck with a knife.' }, { timeout: 5000 }),
    ).toBeInTheDocument()
    // Give a raced bootstrapIfEmpty call (useChallengeGate, still mounted for a moment) a chance to run.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(screen.getByRole('progressbar', { name: 'Setup progress' })).toHaveAttribute('aria-valuetext', 'Step 1 of 6')
    expect(await db.challenges.count()).toBe(0)
  })

  it('opens the app unlocked after the lock is turned on in onboarding', async () => {
    render(<App />)
    await screen.findByRole('button', { name: 'Get started' }, { timeout: 5000 })
    await act(async () => {
      await profileRepo.completeOnboarding({ name: 'Daniel', why: 'A fresh start' }, { startDate: todayISO(), variant: 'hard' })
    })

    fireEvent.click(await screen.findByRole('button', { name: 'Set a PIN' }))
    for (const pin of ['482915', '482915']) {
      await screen.findByRole('status', { name: '0 of 6 digits entered' })
      for (const digit of pin) fireEvent.click(screen.getByRole('button', { name: digit }))
    }

    expect(await screen.findByText('“A fresh start”', undefined, { timeout: 5000 })).toBeVisible()
    expect((await appLockRepo.get())?.pin).toBeDefined()
    expect(screen.queryByRole('heading', { name: '75 Hard is locked' })).not.toBeInTheDocument()
  })
})

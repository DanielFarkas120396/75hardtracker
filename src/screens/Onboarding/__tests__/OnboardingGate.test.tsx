import { fireEvent, render, screen } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { addChallenge, freshDatabase } from '../../../db/__tests__/fixtures'
import { profileRepo } from '../../../db/repositories/profileRepo'
import { useProfile } from '../../../hooks/useProfile'
import { addDaysISO, todayISO } from '../../../lib/dates'
import { OnboardingGate } from '../OnboardingGate'

const today = todayISO()

/** Stands in for the main app, showing the profile it's given. */
function MainAppProbe() {
  const profile = useProfile()
  return <p>Main app for {profile?.name}</p>
}

function renderGate() {
  render(
    <OnboardingGate today={today} loading={<p>Loading…</p>}>
      <MainAppProbe />
    </OnboardingGate>,
  )
}

/** Past the welcome and name steps; the step that follows tells the two modes apart. */
async function passWelcomeAndName() {
  fireEvent.click(await screen.findByRole('button', { name: 'Get started' }))
  fireEvent.change(await screen.findByRole('textbox', { name: 'Your name' }), { target: { value: 'Daniel' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
}

describe('OnboardingGate', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  beforeEach(freshDatabase)

  it('welcomes a new player, who picks a challenge next', async () => {
    renderGate()
    await passWelcomeAndName()

    expect(await screen.findByRole('heading', { name: 'Pick your challenge' })).toBeInTheDocument()
    expect(screen.queryByText(/Main app/)).not.toBeInTheDocument()
  })

  it('welcomes a returning player, who goes straight to the reason', async () => {
    await addChallenge({ startDate: addDaysISO(today, -3), attemptNumber: 1, status: 'active' })
    renderGate()
    await passWelcomeAndName()

    expect(await screen.findByRole('heading', { name: 'Why are you doing this?' })).toBeInTheDocument()
  })

  it('opens the app, with the profile provided, once the player has one', async () => {
    await profileRepo.completeOnboarding({ name: 'Daniel', why: 'A fresh start' })
    renderGate()

    expect(await screen.findByText('Main app for Daniel')).toBeInTheDocument()
  })

  it('swaps to the app as soon as the flow is finished', async () => {
    renderGate()
    await passWelcomeAndName()
    // Each step's heading is awaited first: until then, the previous step may still be leaving.
    await screen.findByRole('heading', { name: 'Pick your challenge' })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' })) // 75 Hard
    await screen.findByRole('heading', { name: 'Why are you doing this?' })
    fireEvent.click(screen.getByRole('button', { name: 'A fresh start' }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByRole('heading', { name: 'When do you start?' })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' })) // today
    await screen.findByRole('heading', { name: 'Deal, Daniel.' })
    fireEvent.click(screen.getByRole('button', { name: "Let's go" }))

    expect(await screen.findByText('Main app for Daniel')).toBeInTheDocument()
  })
})

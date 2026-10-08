import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { addChallenge, freshDatabase } from '../../../db/__tests__/fixtures'
import { appLockRepo } from '../../../db/repositories/appLockRepo'
import { profileRepo } from '../../../db/repositories/profileRepo'
import { useProfile } from '../../../hooks/useProfile'
import { addDaysISO, todayISO } from '../../../lib/dates'
import { hashPin } from '../../../lib/pin'
import { OnboardingGate } from '../OnboardingGate'

const today = todayISO()

const faceId = vi.hoisted(() => ({ available: false }))
vi.mock('../../../lib/appLock', async (original) => ({
  ...(await original<typeof import('../../../lib/appLock')>()),
  isAppLockAvailable: async () => faceId.available,
}))

// The real PIN hashing, with few rounds so the tests stay fast.
vi.mock('../../../lib/pin', async (original) => {
  const actual = await original<typeof import('../../../lib/pin')>()
  return { ...actual, hashPin: (pin: string) => actual.hashPin(pin, 1_000) }
})

// A PIN save (hashing, then IndexedDB) can take seconds under a loaded test run.
const SAVED = { timeout: 5000 }

const offerHeading = () => screen.findByRole('heading', { name: 'Keep it private?' })

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
  // The flow is a lazy chunk: under a loaded test run, its first render can take more than a second.
  fireEvent.click(await screen.findByRole('button', { name: 'Get started' }, { timeout: 5000 }))
  fireEvent.change(await screen.findByRole('textbox', { name: 'What should the duck call you?' }), { target: { value: 'Daniel' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
}

/** The welcome flow is showing, then the profile appears (as when the deal is signed, or a backup restored). */
async function finishFlowBehindTheScenes() {
  renderGate()
  await screen.findByRole('button', { name: 'Get started' }, { timeout: 5000 })
  await act(async () => {
    await profileRepo.completeOnboarding({ name: 'Daniel', why: 'A fresh start' })
  })
}

function typePin(pin: string) {
  for (const digit of pin) fireEvent.click(screen.getByRole('button', { name: digit }))
}

async function setPin() {
  fireEvent.click(screen.getByRole('button', { name: 'Set a PIN' }))
  await screen.findByRole('heading', { name: 'Choose a 6-digit PIN' })
  typePin('482915')
  await screen.findByRole('heading', { name: 'Type it again' })
  typePin('482915')
}

describe('OnboardingGate', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  beforeEach(async () => {
    localStorage.clear() // the welcome flow's draft
    faceId.available = false
    await freshDatabase()
  })

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
    expect(screen.queryByRole('heading', { name: 'Keep it private?' })).not.toBeInTheDocument()
  })

  it('swaps to the app as soon as the flow is finished', async () => {
    renderGate()
    await passWelcomeAndName()
    // Each step's heading is awaited first: until then, the previous step may still be leaving.
    await screen.findByRole('heading', { name: 'Pick your challenge' })
    fireEvent.click(screen.getByRole('radio', { name: /^75 Hard/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByRole('heading', { name: 'Why are you doing this?' })
    fireEvent.click(screen.getByRole('button', { name: 'A fresh start' }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByRole('heading', { name: 'When do you start?' })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByRole('heading', { name: 'Deal, Daniel.' })
    fireEvent.keyDown(screen.getByRole('button', { name: 'Sign the deal: draw a checkmark.' }), { key: 'Enter' }) // as VoiceOver or a keyboard
    fireEvent.click(screen.getByRole('button', { name: 'I commit' }))

    // The duck has its moment (SIGNED_BEAT_MS) before the save, then the lock offer comes before the app.
    expect(await screen.findByRole('heading', { name: 'Keep it private?' }, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.queryByText(/Main app/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))

    expect(await screen.findByText('Main app for Daniel')).toBeInTheDocument()
    expect(await appLockRepo.get()).toBeNull()
  })

  it('opens the app once a PIN is set on the offer, with the lock on', async () => {
    await finishFlowBehindTheScenes()
    await offerHeading()
    await setPin()

    expect(await screen.findByText('Main app for Daniel', {}, SAVED)).toBeInTheDocument()
    expect((await appLockRepo.get())?.pin).toBeDefined()
  })

  it('keeps the offer on for the Face ID question, though the PIN turned the lock on', async () => {
    faceId.available = true
    await finishFlowBehindTheScenes()
    await offerHeading()
    await setPin()

    expect(await screen.findByRole('heading', { name: 'Also unlock with Face ID?' }, SAVED)).toBeInTheDocument()
    await waitFor(async () => expect(await appLockRepo.get()).not.toBeNull())
    expect(screen.queryByText(/Main app/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))

    expect(await screen.findByText('Main app for Daniel')).toBeInTheDocument()
  })

  it('skips the offer when the lock is already on', async () => {
    await appLockRepo.enable(await hashPin('482915'))
    await finishFlowBehindTheScenes()

    expect(await screen.findByText('Main app for Daniel')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Keep it private?' })).not.toBeInTheDocument()
  })
})

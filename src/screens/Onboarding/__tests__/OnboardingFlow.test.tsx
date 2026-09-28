import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../../db/db'
import { addChallenge, freshDatabase } from '../../../db/__tests__/fixtures'
import { profileRepo } from '../../../db/repositories/profileRepo'
import { addDaysISO, todayISO } from '../../../lib/dates'
import { OnboardingFlow } from '../OnboardingFlow'

const today = todayISO()

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))
const heading = (name: string) => screen.findByRole('heading', { name })
const nameField = () => screen.getByRole('textbox', { name: 'Your name' })
const whyField = () => screen.getByRole('textbox', { name: 'Your why' })

/** From the welcome screen, past the name step with `name`. */
async function passWelcomeAndName(name = 'Daniel') {
  click('Get started')
  await heading('What should the duck call you?')
  fireEvent.change(nameField(), { target: { value: name } })
  click('Continue')
}

describe('OnboardingFlow', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  beforeEach(freshDatabase)

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('walks a new player through every step and creates attempt #1 with the profile', async () => {
    render(<OnboardingFlow mode="new" today={today} />)

    expect(await heading('75 days. 5 tasks. One duck with a knife.')).toHaveFocus()
    click('Get started')

    expect(await heading('What should the duck call you?')).toHaveFocus()
    fireEvent.change(nameField(), { target: { value: '  Daniel ' } })
    click('Continue')

    await heading('Pick your challenge')
    fireEvent.click(screen.getByRole('radio', { name: /^75 Medium/ }))
    click('Continue')

    await heading('Why are you doing this?')
    click('A fresh start')
    expect(whyField()).toHaveValue('A fresh start')
    click('Continue')

    await heading('When do you start?')
    fireEvent.click(screen.getByRole('radio', { name: 'Tomorrow' }))
    click('Continue')

    expect(await heading('Deal, Daniel.')).toBeInTheDocument()
    expect(screen.getByText('75 Medium starts tomorrow.')).toBeInTheDocument()
    expect(screen.getByText('“A fresh start”')).toBeInTheDocument()
    click("Let's go")

    await waitFor(async () => expect(await profileRepo.get()).toMatchObject({ name: 'Daniel', why: 'A fresh start' }))
    expect(await db.challenges.toArray()).toMatchObject([
      { attemptNumber: 1, status: 'active', variant: 'medium', startDate: addDaysISO(today, 1) },
    ])
  })

  it('asks a returning player only for a name and a reason, and leaves the attempts alone', async () => {
    const challengeId = await addChallenge({ startDate: addDaysISO(today, -3), attemptNumber: 1, status: 'active' })
    const before = await db.challenges.get(challengeId)
    render(<OnboardingFlow mode="returning" today={today} />)

    await passWelcomeAndName()
    await heading('Why are you doing this?')
    fireEvent.change(whyField(), { target: { value: 'Clear my head' } })
    click('Continue')

    expect(await heading('Welcome back, Daniel.')).toBeInTheDocument()
    expect(screen.getByText('Your challenge is right where you left it.')).toBeInTheDocument()
    click("Let's go")

    await waitFor(async () => expect(await profileRepo.get()).toMatchObject({ name: 'Daniel', why: 'Clear my head' }))
    expect(await db.challenges.toArray()).toEqual([before])
  })

  it('moves on only with a usable name, and Enter moves on too', async () => {
    render(<OnboardingFlow mode="new" today={today} />)
    click('Get started')
    await heading('What should the duck call you?')

    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
    fireEvent.change(nameField(), { target: { value: '   ' } })
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()

    fireEvent.change(nameField(), { target: { value: 'Daniel' } })
    fireEvent.keyDown(nameField(), { key: 'Enter' })
    expect(await heading('Pick your challenge')).toBeInTheDocument()
  })

  it('ignores a second tap while the step is still leaving', async () => {
    render(<OnboardingFlow mode="new" today={today} />)
    const getStarted = screen.getByRole('button', { name: 'Get started' })
    fireEvent.click(getStarted)
    fireEvent.click(getStarted) // a second tap, still on the welcome step's (leaving) button

    expect(await heading('What should the duck call you?')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Pick your challenge' })).not.toBeInTheDocument()

    const field = nameField()
    fireEvent.change(field, { target: { value: 'Daniel' } })
    fireEvent.keyDown(field, { key: 'Enter' })
    fireEvent.keyDown(field, { key: 'Enter' }) // a second Enter, still on the name step's (leaving) field

    expect(await heading('Pick your challenge')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Why are you doing this?' })).not.toBeInTheDocument()
  })

  it('leaves the step in place when Enter confirms an IME composition', async () => {
    render(<OnboardingFlow mode="new" today={today} />)
    click('Get started')
    await heading('What should the duck call you?')

    fireEvent.change(nameField(), { target: { value: 'Daniel' } })
    fireEvent.keyDown(nameField(), { key: 'Enter', isComposing: true })

    // Give a wrongly triggered transition a chance to finish before checking it never started.
    await waitFor(() => expect(screen.getByRole('heading', { name: 'What should the duck call you?' })).toBeInTheDocument())
    expect(screen.queryByRole('heading', { name: 'Pick your challenge' })).not.toBeInTheDocument()
  })

  it('keeps what was entered when going back', async () => {
    render(<OnboardingFlow mode="new" today={today} />)
    await passWelcomeAndName()
    await heading('Pick your challenge')
    fireEvent.click(screen.getByRole('radio', { name: /^75 Soft/ }))

    click('Back')
    expect(await heading('What should the duck call you?')).toBeInTheDocument()
    expect(nameField()).toHaveValue('Daniel')

    click('Continue')
    await heading('Pick your challenge')
    expect(screen.getByRole('radio', { name: /^75 Soft/ })).toHaveAttribute('aria-checked', 'true')
  })

  it('needs a reason, which the ideas fill and the player can still edit', async () => {
    render(<OnboardingFlow mode="returning" today={today} />)
    await passWelcomeAndName()
    await heading('Why are you doing this?')
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()

    click('Build real discipline')
    expect(screen.getByRole('button', { name: 'Build real discipline' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.change(whyField(), { target: { value: 'Build real discipline, finally' } })
    expect(screen.getByRole('button', { name: 'Build real discipline' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
  })

  it('refuses a start date in the past', async () => {
    render(<OnboardingFlow mode="new" today={today} />)
    await passWelcomeAndName()
    await heading('Pick your challenge')
    click('Continue')
    await heading('Why are you doing this?')
    click('A fresh start')
    click('Continue')
    await heading('When do you start?')

    fireEvent.click(screen.getByRole('radio', { name: 'Pick a date' }))
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: addDaysISO(today, -1) } })

    expect(screen.getByRole('alert')).toHaveTextContent("The start can't be in the past.")
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
  })

  it('flags the ready step once a picked start date has slipped into the past', async () => {
    const { rerender } = render(<OnboardingFlow mode="new" today={today} />)
    await passWelcomeAndName()
    await heading('Pick your challenge')
    click('Continue')
    await heading('Why are you doing this?')
    click('A fresh start')
    click('Continue')
    await heading('When do you start?')

    fireEvent.click(screen.getByRole('radio', { name: 'Pick a date' })) // keeps the default picked date: today
    click('Continue')

    await heading('Deal, Daniel.')
    rerender(<OnboardingFlow mode="new" today={addDaysISO(today, 1)} />)

    expect(screen.getByRole('alert')).toHaveTextContent("The start can't be in the past.")
    expect(screen.getByRole('button', { name: "Let's go" })).toBeDisabled()
  })

  it('says so, and lets the player try again, when saving fails', async () => {
    vi.spyOn(profileRepo, 'completeOnboarding').mockRejectedValueOnce(new Error('quota'))
    render(<OnboardingFlow mode="returning" today={today} />)
    await passWelcomeAndName()
    await heading('Why are you doing this?')
    click('A fresh start')
    click('Continue')
    await heading('Welcome back, Daniel.')

    click("Let's go")

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't save that — try again.")
    expect(screen.getByRole('button', { name: "Let's go" })).toBeEnabled()
  })

  it('shows how far along the flow is, with Back from the second screen on', async () => {
    render(<OnboardingFlow mode="new" today={today} />)
    const progress = () => screen.getByRole('progressbar', { name: 'Welcome progress' })

    expect(progress()).toHaveAttribute('aria-valuetext', 'Step 1 of 6')
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()

    click('Get started')
    await heading('What should the duck call you?')
    expect(progress()).toHaveAttribute('aria-valuetext', 'Step 2 of 6')
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
  })

  it('keeps rendering a step, without crashing, when the mode flips mid-flow (e.g. another tab)', async () => {
    const { rerender } = render(<OnboardingFlow mode="new" today={today} />)
    await passWelcomeAndName()
    await heading('Pick your challenge')
    click('Continue')
    await heading('Why are you doing this?')
    click('A fresh start')
    click('Continue')
    await heading('When do you start?')
    click('Continue')
    await heading('Deal, Daniel.')

    // An attempt appeared (another tab): the gate would now render this flow in 'returning' mode.
    rerender(<OnboardingFlow mode="returning" today={today} />)

    expect(await heading('Welcome back, Daniel.')).toBeInTheDocument()
  })
})

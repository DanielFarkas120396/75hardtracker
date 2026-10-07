import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../../db/db'
import { addChallenge, freshDatabase } from '../../../db/__tests__/fixtures'
import { profileRepo } from '../../../db/repositories/profileRepo'
import { addDaysISO, dateForDayNumber, formatShortDay, todayISO } from '../../../lib/dates'
import { draftKey } from '../../../lib/onboardingDraft'
import { OnboardingFlow, SIGNED_BEAT_MS } from '../OnboardingFlow'

const today = todayISO()

// The clock, in minutes since midnight: morning unless a test says otherwise.
const clock = vi.hoisted(() => ({ nowMin: 9 * 60 }))
vi.mock('../../../hooks/useNow', () => ({ useNow: () => clock.nowMin }))

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))
const heading = (name: string) => screen.findByRole('heading', { name })
const nameField = () => screen.getByRole('textbox', { name: 'What should the duck call you?' })
const whyField = () => screen.getByRole('textbox', { name: 'Your why' })

/** On the challenge step: tap a card (none is preselected) and move on. */
async function pickChallenge(name = /^75 Hard/) {
  await heading('Pick your challenge')
  fireEvent.click(screen.getByRole('radio', { name }))
  click('Continue')
}

/** A draft, as the flow saves it, for the scratch test database. */
function seedDraft(draft: Record<string, unknown>) {
  localStorage.setItem(
    draftKey(db.name),
    JSON.stringify({ step: 'ready', name: 'Daniel', variant: 'hard', why: 'A fresh start', startChoice: 'tomorrow', pickedDate: '', ...draft }),
  )
}

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

  beforeEach(async () => {
    localStorage.clear() // the flow's draft
    clock.nowMin = 9 * 60
    await freshDatabase()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('walks a new player through every step and creates attempt #1 with the profile', async () => {
    render(<OnboardingFlow mode="new" today={today} />)

    expect(await heading('75 days. 5 tasks. One duck with a knife.')).toHaveFocus()
    click('Get started')

    await waitFor(() => expect(screen.getByRole('heading', { name: 'What should the duck call you?' })).toHaveFocus())
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
    const deal = screen.getByRole('region', { name: 'The deal' })
    expect(deal).toHaveTextContent('1 session of at least 45 minutes.')
    expect(deal).toHaveTextContent('One joker: one missed day forgiven. Miss one more: back to Day 1.')
    expect(deal).toHaveTextContent(
      `${formatShortDay(addDaysISO(today, 1))} → ${formatShortDay(dateForDayNumber(addDaysISO(today, 1), 75))}`,
    )
    expect(screen.getByText('“A fresh start”')).toBeInTheDocument()
    click('Hold to commit') // a click with no press: as VoiceOver or a keyboard

    // The duck takes the signature first; the save waits for that moment.
    expect(screen.getByText("I'm watching, Daniel.")).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Hold to commit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
    expect(await profileRepo.get()).toBeUndefined()

    await waitFor(async () => expect(await profileRepo.get()).toMatchObject({ name: 'Daniel', why: 'A fresh start' }), {
      timeout: SIGNED_BEAT_MS + 2000,
    })
    expect(await db.challenges.toArray()).toMatchObject([
      { attemptNumber: 1, status: 'active', variant: 'medium', startDate: addDaysISO(today, 1) },
    ])
    expect(localStorage.length).toBe(0) // the draft is gone
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

    expect(screen.getByText('Write a reason or tap an idea to continue.')).toBeInTheDocument()
    click('Build real discipline')
    expect(whyField()).toHaveValue('Build real discipline')
    expect(screen.queryByText('Write a reason or tap an idea to continue.')).not.toBeInTheDocument()

    fireEvent.change(whyField(), { target: { value: 'Build real discipline, finally' } })
    expect(screen.queryByRole('button', { name: 'Build real discipline' })).not.toBeInTheDocument() // own words now
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
  })

  it('refuses a start date in the past', async () => {
    render(<OnboardingFlow mode="new" today={today} />)
    await passWelcomeAndName()
    await pickChallenge()
    await heading('Why are you doing this?')
    click('A fresh start')
    click('Continue')
    await heading('When do you start?')

    fireEvent.click(screen.getByRole('radio', { name: 'Pick a date' }))
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: addDaysISO(today, -1) } })

    expect(screen.getByRole('alert')).toHaveTextContent("The start can't be in the past.")
    expect(screen.getByLabelText('Start date')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Start date')).toHaveAccessibleDescription("The start can't be in the past.")
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
  })

  it('flags the ready step once a picked start date has slipped into the past', async () => {
    const { rerender } = render(<OnboardingFlow mode="new" today={today} />)
    await passWelcomeAndName()
    await pickChallenge()
    await heading('Why are you doing this?')
    click('A fresh start')
    click('Continue')
    await heading('When do you start?')

    fireEvent.click(screen.getByRole('radio', { name: 'Pick a date' })) // keeps the default picked date: tomorrow
    click('Continue')

    await heading('Deal, Daniel.')
    rerender(<OnboardingFlow mode="new" today={addDaysISO(today, 2)} />)

    expect(screen.getByRole('alert')).toHaveTextContent("The start can't be in the past.")
    expect(screen.getByRole('button', { name: 'Hold to commit' })).toBeDisabled()

    click('Change start date')
    expect(await heading('When do you start?')).toBeInTheDocument()
  })

  it('goes back to the deal, saying so, when signing fails to save', async () => {
    vi.spyOn(profileRepo, 'completeOnboarding').mockRejectedValueOnce(new Error('quota'))
    seedDraft({ step: 'ready' })
    render(<OnboardingFlow mode="new" today={today} />)
    await heading('Deal, Daniel.')

    click('Hold to commit')
    expect(screen.getByText("I'm watching, Daniel.")).toBeInTheDocument()

    expect(await screen.findByRole('alert', {}, { timeout: SIGNED_BEAT_MS + 2000 })).toHaveTextContent(
      "Couldn't save that — try again.",
    )
    expect(screen.getByRole('button', { name: 'Hold to commit' })).toBeEnabled()
    expect(screen.queryByText("I'm watching, Daniel.")).not.toBeInTheDocument()
  })

  it('preselects no challenge: Continue waits for a tap', async () => {
    render(<OnboardingFlow mode="new" today={today} />)
    await passWelcomeAndName()
    await heading('Pick your challenge')

    for (const radio of screen.getAllByRole('radio')) expect(radio).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveAccessibleDescription('Pick a challenge to continue.')

    fireEvent.click(screen.getByRole('radio', { name: /^75 Strong/ }))
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
    expect(screen.getByRole('radio', { name: /^75 Strong/ })).toHaveTextContent(
      'Everything in 75 Hard, plus one social occasion a week',
    )
  })

  it('reopens a restored draft on the first step whose answer no longer holds', async () => {
    seedDraft({ step: 'ready', why: '   ' })
    const first = render(<OnboardingFlow mode="new" today={today} />)
    expect(await heading('Why are you doing this?')).toBeInTheDocument()
    first.unmount()

    seedDraft({ step: 'ready', startChoice: 'pick', pickedDate: addDaysISO(today, -1) })
    const second = render(<OnboardingFlow mode="new" today={today} />)
    expect(await heading('When do you start?')).toBeInTheDocument()
    second.unmount()

    seedDraft({ step: 'why', variant: null })
    render(<OnboardingFlow mode="new" today={today} />)
    expect(await heading('Pick your challenge')).toBeInTheDocument()
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
    const progress = () => screen.getByRole('progressbar', { name: 'Setup progress' })

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
    await pickChallenge()
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
  it('comes back to the same step, with the answers so far, after a restart', async () => {
    const { unmount } = render(<OnboardingFlow mode="new" today={today} />)
    await passWelcomeAndName()
    await heading('Pick your challenge')
    fireEvent.click(screen.getByRole('radio', { name: /^75 Strong/ }))
    unmount() // iOS closed the app

    render(<OnboardingFlow mode="new" today={today} />)
    expect(await heading('Pick your challenge')).toHaveFocus()
    expect(screen.getByRole('radio', { name: /^75 Strong/ })).toHaveAttribute('aria-checked', 'true')
    click('Back')
    await heading('What should the duck call you?')
    expect(nameField()).toHaveValue('Daniel')
  })

  it('hides the ideas once the player writes their own reason, so a tap never wipes it', async () => {
    render(<OnboardingFlow mode="returning" today={today} />)
    await passWelcomeAndName()
    await heading('Why are you doing this?')
    for (const idea of ['Prove I can finish what I start', 'Build real discipline', 'Clear my head', 'A fresh start']) {
      expect(screen.getByRole('button', { name: idea })).toBeInTheDocument()
    }

    fireEvent.change(whyField(), { target: { value: 'For my kids' } })
    expect(screen.queryByRole('button', { name: 'Clear my head' })).not.toBeInTheDocument()

    fireEvent.change(whyField(), { target: { value: '' } })
    expect(screen.getByRole('button', { name: 'Clear my head' })).toBeInTheDocument()
  })

  it('counts the characters as the reason nears its limit', async () => {
    render(<OnboardingFlow mode="returning" today={today} />)
    await passWelcomeAndName()
    await heading('Why are you doing this?')

    fireEvent.change(whyField(), { target: { value: 'x'.repeat(99) } })
    expect(screen.queryByText('99/140')).not.toBeInTheDocument()
    fireEvent.change(whyField(), { target: { value: 'x'.repeat(120) } })
    expect(screen.getByText('120/140')).toBeInTheDocument()
  })

  it('shows Day 1 and Day 75, starting today in the morning', async () => {
    render(<OnboardingFlow mode="new" today={today} />)
    await passWelcomeAndName()
    await pickChallenge()
    await heading('Why are you doing this?')
    click('A fresh start')
    click('Continue')
    await heading('When do you start?')

    expect(screen.getByRole('radio', { name: 'Today' })).toHaveAttribute('aria-checked', 'true')
    expect(
      screen.getByText(`Day 1: ${formatShortDay(today)} · Day 75: ${formatShortDay(dateForDayNumber(today, 75))}.`),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Tomorrow might be smarter/)).not.toBeInTheDocument()
  })

  it('starts tomorrow by default in the evening, and warns when today is picked anyway', async () => {
    clock.nowMin = 21 * 60 + 5
    render(<OnboardingFlow mode="new" today={today} />)
    await passWelcomeAndName()
    await pickChallenge()
    await heading('Why are you doing this?')
    click('A fresh start')
    click('Continue')
    await heading('When do you start?')

    expect(screen.getByRole('radio', { name: 'Tomorrow' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByText(/Tomorrow might be smarter/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: 'Today' }))
    const warning = "It's 21:05. Today means two workouts before midnight. Tomorrow might be smarter."
    expect(screen.getByText(warning)).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: 'When to start' })).toHaveAccessibleDescription(warning)
  })

  it('refuses a start more than 60 days ahead', async () => {
    render(<OnboardingFlow mode="new" today={today} />)
    await passWelcomeAndName()
    await pickChallenge()
    await heading('Why are you doing this?')
    click('A fresh start')
    click('Continue')
    await heading('When do you start?')

    fireEvent.click(screen.getByRole('radio', { name: 'Pick a date' }))
    expect(screen.getByLabelText('Start date')).toHaveAttribute('max', addDaysISO(today, 60))
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: addDaysISO(today, 61) } })

    expect(screen.getByRole('alert')).toHaveTextContent('Start within the next 60 days.')
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
  })
})

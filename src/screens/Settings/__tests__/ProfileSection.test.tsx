import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { freshDatabase, TEST_PROFILE } from '../../../db/__tests__/fixtures'
import { profileRepo } from '../../../db/repositories/profileRepo'
import { ProfileContext } from '../../../hooks/useProfile'
import { ProfileSection } from '../ProfileSection'

/** A stored profile, with the section rendered inside the context the app provides. */
async function setup() {
  await profileRepo.completeOnboarding({ name: TEST_PROFILE.name, why: TEST_PROFILE.why })
  render(
    <ProfileContext.Provider value={await profileRepo.get()}>
      <ProfileSection />
    </ProfileContext.Provider>,
  )
}

describe('ProfileSection', () => {
  beforeEach(freshDatabase)

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the name and the reason, ready to edit', async () => {
    await setup()

    expect(screen.getByRole('heading', { name: 'Profile' })).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('Daniel')
    expect(screen.getByLabelText("Why you're doing this")).toHaveValue('A fresh start')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('saves a new name and reason', async () => {
    await setup()

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Dan' } })
    fireEvent.change(screen.getByLabelText("Why you're doing this"), { target: { value: 'Clear my head' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Saved.')
    expect(await profileRepo.get()).toMatchObject({ name: 'Dan', why: 'Clear my head' })
  })

  it('refuses an empty name', async () => {
    await setup()

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  ' } })

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('says so, and lets the player try again, when saving fails', async () => {
    await setup()
    vi.spyOn(profileRepo, 'save').mockRejectedValueOnce(new Error('quota'))

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Dan' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('status')).toHaveTextContent("Couldn't save that — try again.")
  })

  it('renders nothing without a profile', () => {
    const { container } = render(<ProfileSection />)
    expect(container).toBeEmptyDOMElement()
  })
})

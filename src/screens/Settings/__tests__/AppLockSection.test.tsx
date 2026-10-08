import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { SAVE_FAILED_LINE } from '../../../content/microcopy'
import { freshDatabase } from '../../../db/__tests__/fixtures'
import { appLockRepo } from '../../../db/repositories/appLockRepo'
import { hashPin, verifyPin } from '../../../lib/pin'
import { AppLockSection } from '../AppLockSection'

const faceId = vi.hoisted(() => ({
  available: false,
  create: vi.fn<(name: string) => Promise<string | null>>(),
}))
vi.mock('../../../lib/appLock', async (original) => ({
  ...(await original<typeof import('../../../lib/appLock')>()),
  isAppLockAvailable: async () => faceId.available,
  createLockCredential: (name: string) => faceId.create(name),
}))

// The real PIN hashing, with few rounds so the tests stay fast.
vi.mock('../../../lib/pin', async (original) => {
  const actual = await original<typeof import('../../../lib/pin')>()
  return { ...actual, hashPin: (pin: string) => actual.hashPin(pin, 1_000) }
})

function typePin(pin: string) {
  for (const digit of pin) fireEvent.click(screen.getByRole('button', { name: digit }))
}

async function typeNewPin(pin = '482915') {
  typePin(pin)
  await screen.findByRole('heading', { name: 'Type it again' })
  typePin(pin)
}

describe('AppLockSection', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  beforeEach(async () => {
    await freshDatabase()
    faceId.available = false
    faceId.create.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('turns the lock on with a PIN typed twice, refusing one too easy to guess', async () => {
    render(<AppLockSection />)
    fireEvent.click(await screen.findByRole('button', { name: 'Turn on the app lock' }))

    typePin('123456')
    expect(await screen.findByRole('alert')).toHaveTextContent('Too easy to guess')
    typePin('482915')
    expect(await screen.findByRole('heading', { name: 'Type it again' })).toBeInTheDocument()
    typePin('482915')

    await waitFor(async () => expect((await appLockRepo.get())?.pin).toBeDefined())
    const config = await appLockRepo.get()
    expect(await verifyPin('482915', config!.pin!)).toBe(true)
    expect(await screen.findByRole('button', { name: 'Change PIN' })).toBeInTheDocument()
  })

  it('starts the pad over when the PIN fails to save, and saves it on the next try', async () => {
    vi.spyOn(appLockRepo, 'enable').mockRejectedValueOnce(new Error('quota'))
    render(<AppLockSection />)
    fireEvent.click(await screen.findByRole('button', { name: 'Turn on the app lock' }))
    await typeNewPin()

    expect(await screen.findByText(SAVE_FAILED_LINE)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Choose a 6-digit PIN' })).toBeInTheDocument()
    expect(screen.queryByText('Saving…')).not.toBeInTheDocument()
    expect(await appLockRepo.get()).toBeNull()

    await typeNewPin()
    expect(await screen.findByRole('button', { name: 'Change PIN' })).toBeInTheDocument()
    expect(screen.queryByText(SAVE_FAILED_LINE)).not.toBeInTheDocument()
  })

  it('asks for the PIN before turning the lock off', async () => {
    await appLockRepo.enable(await hashPin('482915'))
    render(<AppLockSection />)
    fireEvent.click(await screen.findByRole('button', { name: 'Turn off the app lock' }))

    typePin('000001')
    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong PIN')
    expect(await appLockRepo.get()).not.toBeNull()

    typePin('482915')
    await waitFor(async () => expect(await appLockRepo.get()).toBeNull())
  })

  it("doesn't offer Face ID where it isn't available (as in this test browser)", async () => {
    await appLockRepo.enable(await hashPin('482915'))
    render(<AppLockSection />)
    expect(await screen.findByRole('button', { name: 'Change PIN' })).toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: 'Also unlock with Face ID' })).not.toBeInTheDocument()
  })

  it('turns Face ID on with the passkey it confirms', async () => {
    faceId.available = true
    faceId.create.mockResolvedValue('credential-1')
    await appLockRepo.enable(await hashPin('482915'))
    render(<AppLockSection />)
    fireEvent.click(await screen.findByRole('switch', { name: 'Also unlock with Face ID' }))

    await waitFor(async () => expect((await appLockRepo.get())?.credentialId).toBe('credential-1'))
    expect(await screen.findByRole('switch', { name: 'Also unlock with Face ID' })).toBeChecked()
  })

  it("keeps Face ID off when it doesn't confirm", async () => {
    faceId.available = true
    faceId.create.mockResolvedValue(null)
    await appLockRepo.enable(await hashPin('482915'))
    render(<AppLockSection />)
    fireEvent.click(await screen.findByRole('switch', { name: 'Also unlock with Face ID' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("Face ID didn't confirm, so it's still off. Try again.")
    expect(screen.getByRole('switch', { name: 'Also unlock with Face ID' })).not.toBeChecked()
    expect((await appLockRepo.get())?.credentialId).toBeUndefined()
  })
})

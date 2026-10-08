import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { SAVE_FAILED_LINE } from '../../../content/microcopy'
import { freshDatabase } from '../../../db/__tests__/fixtures'
import { appLockRepo } from '../../../db/repositories/appLockRepo'
import { verifyPin } from '../../../lib/pin'
import { LockOffer } from '../LockOffer'

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

// A PIN save (hashing, then IndexedDB) can take seconds under a loaded test run.
const SAVED = { timeout: 5000 }

const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }))

function typePin(pin: string) {
  for (const digit of pin) fireEvent.click(screen.getByRole('button', { name: digit }))
}

async function setPin(pin = '482915') {
  click('Set a PIN')
  await screen.findByRole('heading', { name: 'Choose a 6-digit PIN' })
  typePin(pin)
  await screen.findByRole('heading', { name: 'Type it again' })
  typePin(pin)
}

describe('LockOffer', () => {
  const onDone = vi.fn()

  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  beforeEach(async () => {
    await freshDatabase()
    faceId.available = false
    faceId.create.mockReset()
    onDone.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('asks once, with a way out that leaves the lock off', async () => {
    render(<LockOffer name="Daniel" onDone={onDone} />)

    expect(screen.getByRole('heading', { name: 'Keep it private?' })).toBeInTheDocument()
    expect(screen.getByText('You can turn it on later in Settings → Privacy & data.')).toBeInTheDocument()
    click('Not now')

    expect(onDone).toHaveBeenCalledOnce()
    expect(await appLockRepo.get()).toBeNull()
  })

  it('goes back to the question from the PIN pad', async () => {
    render(<LockOffer name="Daniel" onDone={onDone} />)
    click('Set a PIN')
    click('Cancel')

    expect(screen.getByRole('heading', { name: 'Keep it private?' })).toBeInTheDocument()
    expect(onDone).not.toHaveBeenCalled()
  })

  it('turns the lock on with a PIN typed twice, and is done where there is no Face ID', async () => {
    render(<LockOffer name="Daniel" onDone={onDone} />)
    await setPin('482915')

    await waitFor(() => expect(onDone).toHaveBeenCalledOnce(), SAVED)
    const config = await appLockRepo.get()
    expect(await verifyPin('482915', config!.pin!)).toBe(true)
    expect(config?.credentialId).toBeUndefined()
    expect(screen.queryByRole('heading', { name: 'Also unlock with Face ID?' })).not.toBeInTheDocument()
  })

  it('starts the pad over when the PIN fails to save', async () => {
    vi.spyOn(appLockRepo, 'enable').mockRejectedValueOnce(new Error('quota'))
    render(<LockOffer name="Daniel" onDone={onDone} />)
    await setPin()

    expect(await screen.findByRole('alert', {}, SAVED)).toHaveTextContent(SAVE_FAILED_LINE)
    expect(screen.getByRole('heading', { name: 'Choose a 6-digit PIN' })).toBeInTheDocument()
    expect(onDone).not.toHaveBeenCalled()
    expect(await appLockRepo.get()).toBeNull()
  })

  it('then offers Face ID where the phone has it, and saves the passkey it confirms', async () => {
    faceId.available = true
    faceId.create.mockResolvedValue('credential-1')
    render(<LockOffer name="Daniel" onDone={onDone} />)
    await setPin()

    await screen.findByRole('heading', { name: 'Also unlock with Face ID?' }, SAVED)
    expect(onDone).not.toHaveBeenCalled()
    click('Turn on Face ID')

    await waitFor(() => expect(onDone).toHaveBeenCalledOnce(), SAVED)
    expect(faceId.create).toHaveBeenCalledWith('Daniel')
    expect((await appLockRepo.get())?.credentialId).toBe('credential-1')
  })

  it('keeps both choices when Face ID does not confirm', async () => {
    faceId.available = true
    faceId.create.mockResolvedValueOnce(null)
    render(<LockOffer name="Daniel" onDone={onDone} />)
    await setPin()
    await screen.findByRole('heading', { name: 'Also unlock with Face ID?' }, SAVED)
    click('Turn on Face ID')

    expect(await screen.findByRole('alert')).toHaveTextContent("Face ID didn't confirm. Try again, or skip it for now.")
    expect(screen.getByRole('button', { name: 'Turn on Face ID' })).toBeEnabled()
    expect(onDone).not.toHaveBeenCalled()

    click('Not now')
    expect(onDone).toHaveBeenCalledOnce()
    const config = await appLockRepo.get()
    expect(config?.pin).toBeDefined()
    expect(config?.credentialId).toBeUndefined()
  })
})

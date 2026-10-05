import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { freshDatabase } from '../../../db/__tests__/fixtures'
import { appLockRepo } from '../../../db/repositories/appLockRepo'
import { hashPin, verifyPin } from '../../../lib/pin'
import { AppLockSection } from '../AppLockSection'

// The real PIN hashing, with few rounds so the tests stay fast.
vi.mock('../../../lib/pin', async (original) => {
  const actual = await original<typeof import('../../../lib/pin')>()
  return { ...actual, hashPin: (pin: string) => actual.hashPin(pin, 1_000) }
})

function typePin(pin: string) {
  for (const digit of pin) fireEvent.click(screen.getByRole('button', { name: digit }))
}

describe('AppLockSection', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  beforeEach(freshDatabase)

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
})

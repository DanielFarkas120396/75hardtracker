import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { PinFailures } from '../../../db/repositories/appLockRepo'
import { LockScreen } from '../LockScreen'

const NO_FAILURES: PinFailures = { count: 0, lockedUntil: null }

function typePin(pin: string) {
  for (const digit of pin) fireEvent.click(screen.getByRole('button', { name: digit }))
}

function renderLock(overrides: Partial<Parameters<typeof LockScreen>[0]> = {}) {
  const props = {
    faceIdEnabled: false,
    failures: NO_FAILURES,
    onFaceId: vi.fn().mockResolvedValue(false),
    onPin: vi.fn().mockResolvedValue({ ok: false, failures: { count: 1, lockedUntil: null } }),
    onConfirmFaceId: vi.fn().mockResolvedValue(false),
    onResetPin: vi.fn().mockResolvedValue(undefined),
    onBypass: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
  render(<LockScreen {...props} />)
  return props
}

describe('LockScreen', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  it('takes the PIN on its pad, and says how many tries are left after a wrong one', async () => {
    const props = renderLock()
    expect(screen.getByRole('heading', { name: '75 Hard is locked' })).toBeInTheDocument()
    expect(props.onFaceId).not.toHaveBeenCalled()

    typePin('48291')
    expect(screen.getByRole('status', { name: '5 of 6 digits entered' })).toBeInTheDocument()
    typePin('5')
    expect(props.onPin).toHaveBeenCalledWith('482915')
    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong PIN. 4 tries left before a wait.')
  })

  it('asks for Face ID first when it is on, with a Face ID key on the pad', async () => {
    const props = renderLock({ faceIdEnabled: true })
    await waitFor(() => expect(props.onFaceId).toHaveBeenCalledOnce())
    fireEvent.click(screen.getByRole('button', { name: 'Unlock with Face ID' }))
    expect(props.onFaceId).toHaveBeenCalledTimes(2)
  })

  it('shows the wait after too many wrong PINs, with the pad disabled', () => {
    renderLock({ failures: { count: 5, lockedUntil: Date.now() + 30_000 } })
    expect(screen.getByText(/Too many wrong PINs\. Try again in 0:(30|29)\./)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '1' })).toBeDisabled()
  })

  it('"Forgot PIN?" sets a new PIN after Face ID, typed twice', async () => {
    const props = renderLock({ faceIdEnabled: true, onConfirmFaceId: vi.fn().mockResolvedValue(true) })
    fireEvent.click(screen.getByRole('button', { name: 'Forgot PIN?' }))
    expect(await screen.findByRole('heading', { name: 'Choose a new PIN' })).toBeInTheDocument()

    typePin('135792')
    expect(await screen.findByRole('heading', { name: 'Type it again' })).toBeInTheDocument()
    typePin('135792')
    expect(props.onResetPin).toHaveBeenCalledWith('135792')
  })

  it('"Can\'t unlock?" asks for confirmation before turning the lock off', async () => {
    const props = renderLock()
    fireEvent.click(screen.getByRole('button', { name: "Can't unlock?" }))
    expect(await screen.findByRole('heading', { name: 'Turn the lock off?' })).toBeInTheDocument()
    expect(props.onBypass).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Turn off and open' }))
    expect(props.onBypass).toHaveBeenCalledOnce()
  })
})

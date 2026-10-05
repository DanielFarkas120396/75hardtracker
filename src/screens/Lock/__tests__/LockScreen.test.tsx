import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { LockScreen } from '../LockScreen'

describe('LockScreen', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  it('asks for Face ID straight away, and again from the button, saying when it fails', async () => {
    const onUnlock = vi.fn().mockResolvedValue(false)
    render(<LockScreen onUnlock={onUnlock} onBypass={vi.fn()} />)
    expect(screen.getByRole('heading', { name: '75 Hard is locked' })).toBeInTheDocument()
    await waitFor(() => expect(onUnlock).toHaveBeenCalledOnce())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Unlock with Face ID/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent("That didn't work")
    expect(onUnlock).toHaveBeenCalledTimes(2)
  })

  it('"Can\'t unlock?" asks for confirmation before turning the lock off', async () => {
    const onBypass = vi.fn().mockResolvedValue(undefined)
    render(<LockScreen onUnlock={vi.fn().mockResolvedValue(false)} onBypass={onBypass} />)

    fireEvent.click(screen.getByRole('button', { name: "Can't unlock?" }))
    expect(await screen.findByRole('heading', { name: 'Turn the lock off?' })).toBeInTheDocument()
    expect(onBypass).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Turn off and open' }))
    expect(onBypass).toHaveBeenCalledOnce()
  })
})

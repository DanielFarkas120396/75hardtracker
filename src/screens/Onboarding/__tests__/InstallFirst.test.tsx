import { fireEvent, render, screen } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { INSTALL_SKIPPED_KEY, shouldOfferInstallFirst, type InstallState } from '../../../lib/installPrompt'
import { InstallFirst } from '../InstallFirst'

const state = vi.hoisted(() => ({ current: 'ios' as InstallState }))
vi.mock('../../../lib/installPrompt', async (original) => ({
  ...(await original<typeof import('../../../lib/installPrompt')>()),
  getInstallState: () => state.current,
}))

describe('shouldOfferInstallFirst', () => {
  it('asks only in a phone browser that can install, until skipped', () => {
    expect(shouldOfferInstallFirst('ios', false)).toBe(true)
    expect(shouldOfferInstallFirst('available', false)).toBe(true)
    expect(shouldOfferInstallFirst('installed', false)).toBe(false)
    expect(shouldOfferInstallFirst('unavailable', false)).toBe(false)
    expect(shouldOfferInstallFirst('ios', true)).toBe(false)
  })
})

describe('InstallFirst', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })

  beforeEach(() => {
    localStorage.clear()
    state.current = 'ios'
  })

  it('on iPhone Safari, shows the 3 steps before the welcome flow, and lets you continue anyway (remembered)', () => {
    const { unmount } = render(<InstallFirst>Welcome flow</InstallFirst>)
    expect(screen.getByRole('heading', { name: 'Add 75 Hard to your Home Screen' })).toBeInTheDocument()
    expect(screen.getByText(/Add to Home Screen/, { selector: 'strong' })).toBeInTheDocument()
    expect(screen.queryByText('Welcome flow')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Continue in the browser anyway' }))
    expect(screen.getByText('Welcome flow')).toBeInTheDocument()
    expect(localStorage.getItem(INSTALL_SKIPPED_KEY)).toBe('1')

    unmount()
    render(<InstallFirst>Welcome flow</InstallFirst>)
    expect(screen.getByText('Welcome flow')).toBeInTheDocument()
  })

  it('goes straight to the welcome flow in the installed app', () => {
    state.current = 'installed'
    render(<InstallFirst>Welcome flow</InstallFirst>)
    expect(screen.getByText('Welcome flow')).toBeInTheDocument()
  })
})

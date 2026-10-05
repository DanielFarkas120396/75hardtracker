import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { freshDatabase } from '../../db/__tests__/fixtures'
import { appLockRepo } from '../../db/repositories/appLockRepo'
import { useAppLock } from '../useAppLock'

const verifyOwner = vi.hoisted(() => vi.fn<(id: string) => Promise<boolean>>())
vi.mock('../../lib/appLock', async (original) => ({
  ...(await original<typeof import('../../lib/appLock')>()),
  verifyOwner,
}))

/** Puts the app in the background or brings it back. */
function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(async () => {
  await freshDatabase()
  verifyOwner.mockReset()
  setHidden(false)
})

describe('useAppLock', () => {
  it('stays open when the lock is off', async () => {
    const { result } = renderHook(() => useAppLock())
    await waitFor(() => expect(result.current.status).toBe('open'))
  })

  it('opens locked when the lock is on, and opens once Face ID passes', async () => {
    await appLockRepo.enable('cred')
    const { result } = renderHook(() => useAppLock())
    await waitFor(() => expect(result.current.status).toBe('locked'))

    verifyOwner.mockResolvedValueOnce(false)
    expect(await act(() => result.current.unlock())).toBe(false)
    expect(result.current.status).toBe('locked')

    verifyOwner.mockResolvedValueOnce(true)
    expect(await act(() => result.current.unlock())).toBe(true)
    expect(result.current.status).toBe('open')
    expect(verifyOwner).toHaveBeenCalledWith('cred')
  })

  it('locks again after more than a minute away, not after a quick switch, and covers the app meanwhile', async () => {
    await appLockRepo.enable('cred')
    verifyOwner.mockResolvedValue(true)
    const { result } = renderHook(() => useAppLock())
    await waitFor(() => expect(result.current.status).toBe('locked'))
    await act(() => result.current.unlock())

    const now = vi.spyOn(Date, 'now')
    now.mockReturnValue(1_000_000)
    act(() => setHidden(true))
    expect(document.documentElement).toHaveAttribute('data-covered')
    now.mockReturnValue(1_020_000)
    act(() => setHidden(false))
    expect(document.documentElement).not.toHaveAttribute('data-covered')
    expect(result.current.status).toBe('open')

    now.mockReturnValue(2_000_000)
    act(() => setHidden(true))
    now.mockReturnValue(2_090_000)
    act(() => setHidden(false))
    expect(result.current.status).toBe('locked')
    now.mockRestore()
  })

  it("doesn't lock you out the moment you turn it on", async () => {
    const { result } = renderHook(() => useAppLock())
    await waitFor(() => expect(result.current.status).toBe('open'))
    await act(() => appLockRepo.enable('cred'))
    await waitFor(() => expect(result.current.status).toBe('open'))
  })

  it("\"Can't unlock?\" opens the app, turns the lock off and leaves the notice", async () => {
    await appLockRepo.enable('cred')
    const { result } = renderHook(() => useAppLock())
    await waitFor(() => expect(result.current.status).toBe('locked'))

    await act(() => result.current.bypass())
    expect(result.current.status).toBe('open')
    expect(await appLockRepo.get()).toBeNull()
    expect(await appLockRepo.getBypassedAt()).not.toBeNull()
  })
})

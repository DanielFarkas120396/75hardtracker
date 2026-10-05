import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { freshDatabase } from '../../db/__tests__/fixtures'
import { appLockRepo } from '../../db/repositories/appLockRepo'
import { hashPin } from '../../lib/pin'
import { useAppLock } from '../useAppLock'

const verifyOwner = vi.hoisted(() => vi.fn<(id: string) => Promise<boolean>>())
vi.mock('../../lib/appLock', async (original) => ({
  ...(await original<typeof import('../../lib/appLock')>()),
  verifyOwner,
}))

const PIN = '482915'

/** Puts the app in the background or brings it back. */
function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
  document.dispatchEvent(new Event('visibilitychange'))
}

/** The lock on, with the PIN (few rounds, for speed) and optionally Face ID. */
async function lockOn({ faceId = false } = {}) {
  await appLockRepo.enable(await hashPin(PIN, 1_000))
  if (faceId) await appLockRepo.setFaceId('cred')
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

  it('opens locked, and opens with the right PIN', async () => {
    await lockOn()
    const { result } = renderHook(() => useAppLock())
    await waitFor(() => expect(result.current.status).toBe('locked'))
    expect(result.current.faceIdEnabled).toBe(false)

    expect(await act(() => result.current.unlockWithPin('111222'))).toMatchObject({ ok: false, failures: { count: 1 } })
    expect(result.current.status).toBe('locked')
    expect(await act(() => result.current.unlockWithPin(PIN))).toEqual({ ok: true })
    expect(result.current.status).toBe('open')
    expect((await appLockRepo.getFailures()).count).toBe(0)
  })

  it('makes you wait after 5 wrong PINs, even for the right one, and the wait survives a relaunch', async () => {
    await lockOn()
    const { result, unmount } = renderHook(() => useAppLock())
    await waitFor(() => expect(result.current.status).toBe('locked'))
    for (let i = 0; i < 4; i++) await act(() => result.current.unlockWithPin('000001'))
    const fifth = await act(() => result.current.unlockWithPin('000001'))
    expect(fifth).toMatchObject({ ok: false, failures: { count: 5 } })
    expect(fifth.ok === false && fifth.failures.lockedUntil).toBeGreaterThan(Date.now())

    unmount()
    const relaunched = renderHook(() => useAppLock())
    await waitFor(() => expect(relaunched.result.current.status).toBe('locked'))
    expect(await act(() => relaunched.result.current.unlockWithPin(PIN))).toMatchObject({ ok: false })
    expect(relaunched.result.current.status).toBe('locked')
  })

  it('opens with Face ID when it is on, and clears the wrong-PIN count', async () => {
    await lockOn({ faceId: true })
    await appLockRepo.recordFailure()
    verifyOwner.mockResolvedValue(true)
    const { result } = renderHook(() => useAppLock())
    await waitFor(() => expect(result.current.faceIdEnabled).toBe(true))

    expect(await act(() => result.current.unlockWithFaceId())).toBe(true)
    expect(result.current.status).toBe('open')
    expect(verifyOwner).toHaveBeenCalledWith('cred')
    expect((await appLockRepo.getFailures()).count).toBe(0)
  })

  it('"Forgot PIN?": a new PIN after Face ID opens the app and replaces the old one', async () => {
    await lockOn({ faceId: true })
    const { result } = renderHook(() => useAppLock())
    await waitFor(() => expect(result.current.status).toBe('locked'))

    await act(() => result.current.resetPinAndUnlock('135792'))
    expect(result.current.status).toBe('open')
    const config = await appLockRepo.get()
    expect(config?.credentialId).toBe('cred')
    expect(config?.pin).toBeDefined()
  })

  it('locks again after more than a minute away, not after a quick switch, and covers the app meanwhile', async () => {
    await lockOn()
    const { result } = renderHook(() => useAppLock())
    await waitFor(() => expect(result.current.status).toBe('locked'))
    await act(() => result.current.unlockWithPin(PIN))

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
    await act(() => lockOn())
    await waitFor(() => expect(result.current.status).toBe('open'))
  })

  it("\"Can't unlock?\" opens the app, turns the lock off and leaves the notice", async () => {
    await lockOn()
    const { result } = renderHook(() => useAppLock())
    await waitFor(() => expect(result.current.status).toBe('locked'))

    await act(() => result.current.bypass())
    expect(result.current.status).toBe('open')
    expect(await appLockRepo.get()).toBeNull()
    expect(await appLockRepo.getBypassedAt()).not.toBeNull()
  })
})

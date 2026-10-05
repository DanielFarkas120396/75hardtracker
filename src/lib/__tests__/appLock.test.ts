import { afterEach, describe, expect, it, vi } from 'vitest'
import { fromBase64Url, isAppLockAvailable, RELOCK_AFTER_MS, shouldRelock, toBase64Url, userWasVerified, verifyOwner } from '../appLock'

afterEach(() => {
  vi.unstubAllGlobals()
})

/** Authenticator data with the given flags byte (37 bytes: rpIdHash, flags, signCount). */
function authenticatorData(flags: number): ArrayBuffer {
  const data = new Uint8Array(37)
  data[32] = flags
  return data.buffer
}

describe('shouldRelock', () => {
  it('locks again only after more than a minute away', () => {
    expect(RELOCK_AFTER_MS).toBe(60_000)
    expect(shouldRelock(null, 1_000_000)).toBe(false)
    expect(shouldRelock(1_000_000, 1_000_000 + 30_000)).toBe(false)
    expect(shouldRelock(1_000_000, 1_000_000 + 60_000)).toBe(false)
    expect(shouldRelock(1_000_000, 1_000_000 + 60_001)).toBe(true)
  })
})

describe('base64url', () => {
  it('round-trips credential ids', () => {
    const bytes = new Uint8Array([0, 1, 250, 251, 252, 253, 254, 255])
    expect(fromBase64Url(toBase64Url(bytes))).toEqual(bytes)
    expect(toBase64Url(bytes)).not.toMatch(/[+/=]/)
  })
})

describe('userWasVerified', () => {
  it('reads the user-verified flag', () => {
    expect(userWasVerified(authenticatorData(0x05))).toBe(true)
    expect(userWasVerified(authenticatorData(0x01))).toBe(false)
    expect(userWasVerified(new ArrayBuffer(10))).toBe(false)
  })
})

describe('isAppLockAvailable', () => {
  it('is false without WebAuthn (as in this test browser)', async () => {
    expect(await isAppLockAvailable()).toBe(false)
  })
})

describe('verifyOwner', () => {
  const credentialId = toBase64Url(new Uint8Array([1, 2, 3]))

  it('accepts an answer where the user was verified', async () => {
    vi.stubGlobal('navigator', {
      credentials: { get: vi.fn().mockResolvedValue({ response: { authenticatorData: authenticatorData(0x05) } }) },
    })
    expect(await verifyOwner(credentialId)).toBe(true)
  })

  it('refuses an unverified answer, a cancel or an error', async () => {
    vi.stubGlobal('navigator', {
      credentials: { get: vi.fn().mockResolvedValue({ response: { authenticatorData: authenticatorData(0x01) } }) },
    })
    expect(await verifyOwner(credentialId)).toBe(false)

    vi.stubGlobal('navigator', { credentials: { get: vi.fn().mockResolvedValue(null) } })
    expect(await verifyOwner(credentialId)).toBe(false)

    vi.stubGlobal('navigator', { credentials: { get: vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError')) } })
    expect(await verifyOwner(credentialId)).toBe(false)
  })
})

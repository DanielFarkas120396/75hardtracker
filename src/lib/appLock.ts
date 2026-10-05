/**
 * The Face ID lock: thin wrappers around WebAuthn with the phone's own
 * (platform) authenticator. Turning the lock on creates a passkey ("75 Hard")
 * that only this device's Face ID, Touch ID or passcode can use; unlocking
 * asks for it. There's no server: a verified answer from the phone is the
 * whole check. It's a privacy curtain over the app, not encryption of the data.
 *
 * WebAuthn needs a secure page on a real domain (or localhost), never an IP
 * address, so it can't run over the Wi-Fi dev link (https://192.168…).
 */

/** Coming back after this long in another app asks for Face ID again. */
export const RELOCK_AFTER_MS = 60_000

/** Whether the app should lock again: it was hidden for longer than RELOCK_AFTER_MS. */
export function shouldRelock(hiddenAt: number | null, now: number): boolean {
  return hiddenAt !== null && now - hiddenAt > RELOCK_AFTER_MS
}

/** Whether this device can lock the app with Face ID, Touch ID or its passcode. */
export async function isAppLockAvailable(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential || !window.isSecureContext) return false
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(length))
}

export function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ''
  for (const byte of array) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4))
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

/**
 * Whether WebAuthn authenticator data says the user was verified (Face ID,
 * Touch ID or the passcode): the UV flag, bit 2 of the flags byte at 32.
 */
export function userWasVerified(authenticatorData: ArrayBuffer): boolean {
  const data = new Uint8Array(authenticatorData)
  return data.length > 32 && (data[32] & 0x04) !== 0
}

/**
 * Creates the lock's passkey, asking for Face ID. Resolves to its credential
 * id (base64url), or null if it was cancelled or failed.
 */
export async function createLockCredential(displayName: string): Promise<string | null> {
  try {
    const credential = (await navigator.credentials.create({
      publicKey: {
        rp: { name: '75 Hard' },
        user: { id: randomBytes(16), name: '75 Hard lock', displayName: displayName || '75 Hard' },
        challenge: randomBytes(32),
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
        timeout: 60_000,
        attestation: 'none',
      },
    })) as PublicKeyCredential | null
    return credential ? toBase64Url(credential.rawId) : null
  } catch {
    return null
  }
}

/** Asks for Face ID with the lock's passkey. Resolves to whether the owner was verified. */
export async function verifyOwner(credentialId: string): Promise<boolean> {
  try {
    const credential = (await navigator.credentials.get({
      publicKey: {
        challenge: randomBytes(32),
        allowCredentials: [{ type: 'public-key', id: fromBase64Url(credentialId), transports: ['internal'] }],
        userVerification: 'required',
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null
    const response = credential?.response as AuthenticatorAssertionResponse | undefined
    return response !== undefined && userWasVerified(response.authenticatorData)
  } catch {
    return false
  }
}

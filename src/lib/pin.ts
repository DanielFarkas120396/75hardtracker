import { isValidPin, sameHash, type StoredPin } from '../logic/appLock'
import { fromBase64Url, toBase64Url } from './appLock'

/**
 * The app lock's PIN: 6 digits, never stored as typed — only a PBKDF2
 * fingerprint (SHA-256, a random salt, many rounds), so reading the
 * database doesn't reveal it at a glance. Wrong PINs cost growing waits.
 */

export { FREE_ATTEMPTS, isTooSimplePin, isValidPin, PIN_LENGTH, waitAfterFailures, type StoredPin } from '../logic/appLock'

export const PIN_ITERATIONS = 210_000

async function derive(pin: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256)
  return toBase64Url(bits)
}

export async function hashPin(pin: string, iterations: number = PIN_ITERATIONS): Promise<StoredPin> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return { hash: await derive(pin, salt, iterations), salt: toBase64Url(salt), iterations }
}

export async function verifyPin(pin: string, stored: StoredPin): Promise<boolean> {
  if (!isValidPin(pin)) return false
  const hash = await derive(pin, fromBase64Url(stored.salt), stored.iterations)
  return sameHash(hash, stored.hash)
}

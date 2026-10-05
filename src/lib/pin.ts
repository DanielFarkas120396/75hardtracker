import { fromBase64Url, toBase64Url } from './appLock'

/**
 * The app lock's PIN: 6 digits, never stored as typed — only a PBKDF2
 * fingerprint (SHA-256, a random salt, many rounds), so reading the
 * database doesn't reveal it at a glance. Wrong PINs cost growing waits.
 */

export const PIN_LENGTH = 6
export const PIN_ITERATIONS = 210_000

export interface StoredPin {
  /** PBKDF2-SHA-256 output, base64url. */
  hash: string
  /** Random salt, base64url. */
  salt: string
  iterations: number
}

export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin)
}

/** PINs too easy to guess: one digit repeated (111111), or a straight run (123456, 654321). */
export function isTooSimplePin(pin: string): boolean {
  if (/^(\d)\1+$/.test(pin)) return true
  const digits = [...pin].map(Number)
  const steps = new Set(digits.slice(1).map((d, i) => d - digits[i]))
  return steps.size === 1 && (steps.has(1) || steps.has(-1))
}

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
  // Compare every character, so the time taken doesn't hint at how much matched.
  let difference = hash.length ^ stored.hash.length
  for (let i = 0; i < Math.min(hash.length, stored.hash.length); i++) {
    difference |= hash.charCodeAt(i) ^ stored.hash.charCodeAt(i)
  }
  return difference === 0
}

/** Wrong PINs allowed before the waits start. */
export const FREE_ATTEMPTS = 5
const WAITS_MS = [30_000, 60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000]

/** How long to wait after this many wrong PINs in a row: none for the first 5, then 30 s, 1 min, 5 min, 15 min, 1 h. */
export function waitAfterFailures(failures: number): number {
  if (failures < FREE_ATTEMPTS) return 0
  return WAITS_MS[Math.min(failures - FREE_ATTEMPTS, WAITS_MS.length - 1)]
}

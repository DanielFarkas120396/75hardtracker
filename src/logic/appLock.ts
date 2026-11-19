/**
 * The app lock's rules, shared by the web app and the native app: a 6-digit
 * PIN (stored only as a PBKDF2 fingerprint), the waits that wrong PINs cost,
 * and when the app locks again after being away. How a PIN is hashed and how
 * Face ID is asked belong to each app.
 */

export const PIN_LENGTH = 6

export interface StoredPin {
  /** PBKDF2-SHA-256 output, base64url. */
  hash: string
  /** Random salt, base64url. */
  salt: string
  iterations: number
}

export interface AppLockConfig {
  /** The PIN's fingerprint. The lock's base: Face ID is the shortcut. */
  pin?: StoredPin
  /** Face ID unlocking is on. The web keeps its passkey's credential id (base64url); the native app any string. */
  credentialId?: string
  enabledAt: string
}

export interface PinFailures {
  /** Wrong PINs in a row. */
  count: number
  /** Epoch ms until which no PIN is accepted, or null. */
  lockedUntil: number | null
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

/** Compares two fingerprints character by character, so the time taken doesn't hint at how much matched. */
export function sameHash(a: string, b: string): boolean {
  let difference = a.length ^ b.length
  for (let i = 0; i < Math.min(a.length, b.length); i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i)
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

/** The line under the pad after a wrong PIN, or null once the wait has started. */
export function wrongPinLine(failures: number): string | null {
  const left = FREE_ATTEMPTS - failures
  return left > 0 ? `Wrong PIN. ${left} ${left === 1 ? 'try' : 'tries'} left before a wait.` : null
}

/** Coming back after this long in another app asks for the lock again. */
export const RELOCK_AFTER_MS = 60_000

/** Whether the app should lock again: it was hidden for longer than RELOCK_AFTER_MS. */
export function shouldRelock(hiddenAt: number | null, now: number): boolean {
  return hiddenAt !== null && now - hiddenAt > RELOCK_AFTER_MS
}

/** "0:27", "4:05", "1:00:00". */
export function formatCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = String(seconds % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

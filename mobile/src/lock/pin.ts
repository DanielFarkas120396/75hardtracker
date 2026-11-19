import { isValidPin, sameHash, type StoredPin } from '@logic/appLock'
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { utf8ToBytes } from '@noble/hashes/utils.js'
import { getRandomBytes } from 'expo-crypto'

/**
 * The app lock's PIN, never stored as typed: only a PBKDF2-SHA-256 fingerprint with a random salt, as the web's
 * (src/lib/pin.ts). The phone derives it in JavaScript, which is far slower than the browser's native code, so it
 * uses fewer rounds; each PIN keeps its own count, so it can change without breaking a saved PIN.
 *
 * ponytail: 15 000 rounds (about a second on Hermes, guessed from a jitless run on the PC). It is a privacy lock,
 * not encryption; measure on the iPhone and raise it if unlocking feels instant.
 */
export const PIN_ITERATIONS = 15_000

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4)), (char) => char.charCodeAt(0))
}

async function derive(pin: string, salt: Uint8Array, iterations: number): Promise<string> {
  return toBase64Url(await pbkdf2Async(sha256, utf8ToBytes(pin), salt, { c: iterations, dkLen: 32 }))
}

export async function hashPin(pin: string, iterations: number = PIN_ITERATIONS): Promise<StoredPin> {
  const salt = getRandomBytes(16)
  return { hash: await derive(pin, salt, iterations), salt: toBase64Url(salt), iterations }
}

export async function verifyPin(pin: string, stored: StoredPin): Promise<boolean> {
  if (!isValidPin(pin)) return false
  return sameHash(await derive(pin, fromBase64Url(stored.salt), stored.iterations), stored.hash)
}

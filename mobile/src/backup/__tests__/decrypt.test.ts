/** @jest-environment node */
import { encryptBackup } from '@logic/backupCrypto'
import { openProtectedBackup } from '@logic/backupReading'
import { pbkdf2Sync } from 'node:crypto'
import { decryptOnPhone, deriveKey } from '../decrypt'
import { sampleBackup } from './sampleBackup'

// expo-crypto's AES is native code: here Node's AES-256-GCM stands in for it, with the same
// inputs (a raw key, a base64 IV, base64 ciphertext with the 16-byte tag at its end).
jest.mock('expo-crypto', () => {
  const { createDecipheriv } = jest.requireActual<typeof import('node:crypto')>('node:crypto')
  return {
    AESEncryptionKey: { import: async (bytes: Uint8Array) => ({ bytes }) },
    AESSealedData: {
      fromParts: (iv: string, data: string, tagLength: number) => ({
        iv: Buffer.from(iv, 'base64'),
        data: Buffer.from(data, 'base64'),
        tagLength,
      }),
    },
    aesDecryptAsync: async (sealed: { iv: Buffer; data: Buffer; tagLength: number }, key: { bytes: Uint8Array }) => {
      const decipher = createDecipheriv('aes-256-gcm', key.bytes, sealed.iv)
      decipher.setAuthTag(sealed.data.subarray(-sealed.tagLength))
      const body = sealed.data.subarray(0, -sealed.tagLength)
      return new Uint8Array(Buffer.concat([decipher.update(body), decipher.final()]))
    },
  }
})

// The web app's own encryption, with few rounds so the tests stay fast.
const ROUNDS = 1000
const JSON_TEXT = JSON.stringify({ hello: 'wörld', day: 34 })

it('derives the same key as PBKDF2-SHA-256 everywhere else', async () => {
  const salt = Buffer.from('0123456789abcdef')
  const key = await deriveKey('correct horse', salt.toString('base64'), ROUNDS)
  expect(Buffer.from(key).toString('hex')).toBe(pbkdf2Sync('correct horse', salt, ROUNDS, 32, 'sha256').toString('hex'))
})

it('opens a backup the web app protected, with the right password', async () => {
  const file = await encryptBackup(JSON_TEXT, 'correct horse', ROUNDS)
  expect(await decryptOnPhone(file, 'correct horse')).toBe(JSON_TEXT)
})

it('gives null for a wrong password', async () => {
  const file = await encryptBackup(JSON_TEXT, 'correct horse', ROUNDS)
  expect(await decryptOnPhone(file, 'wrong horse')).toBeNull()
})

it('gives null when the file was changed', async () => {
  const file = await encryptBackup(JSON_TEXT, 'correct horse', ROUNDS)
  const bytes = Buffer.from(file.data, 'base64')
  bytes[0] ^= 1
  expect(await decryptOnPhone({ ...file, data: bytes.toString('base64') }, 'correct horse')).toBeNull()
})

it('gives null for a salt or rounds that make no sense, instead of throwing', async () => {
  const file = await encryptBackup(JSON_TEXT, 'correct horse', ROUNDS)
  expect(await decryptOnPhone({ ...file, kdf: { ...file.kdf, iterations: -5 } }, 'correct horse')).toBeNull()
})

it('plugs into the shared backup reader', async () => {
  const backup = sampleBackup()
  const file = await encryptBackup(JSON.stringify(backup), 'correct horse', ROUNDS)
  const opened = await openProtectedBackup(file, 'correct horse', decryptOnPhone)
  expect(opened).toEqual({ ok: true, payload: backup })
  expect(await openProtectedBackup(file, 'nope', decryptOnPhone)).toEqual({
    ok: false,
    error: 'Wrong password, or the file was changed.',
  })
})

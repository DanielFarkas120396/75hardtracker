import type { EncryptedBackup } from '@logic/backupCrypto'
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { utf8ToBytes } from '@noble/hashes/utils.js'
import { AESEncryptionKey, AESSealedData, aesDecryptAsync } from 'expo-crypto'

/**
 * Opens a password-protected backup made by the web app (src/logic/backupCrypto.ts:
 * AES-256-GCM under a PBKDF2-SHA-256 key). The phone has no WebCrypto, so the
 * key is derived in JavaScript and the AES runs in expo-crypto's native code,
 * which takes the file's base64 as it is.
 *
 * ponytail: PBKDF2 in JavaScript, at the file's 310 000 rounds, takes seconds on
 * a phone (it yields as it goes, so the screen stays alive). If that proves too
 * slow, a native crypto library does it in milliseconds but needs a development build.
 */

const fromBase64 = (text: string) => Uint8Array.from(atob(text), (char) => char.charCodeAt(0))

/** The 32-byte AES key for a password, a base64 salt and a number of rounds. */
export function deriveKey(password: string, saltBase64: string, iterations: number): Promise<Uint8Array> {
  return pbkdf2Async(sha256, utf8ToBytes(password), fromBase64(saltBase64), { c: iterations, dkLen: 32 })
}

/** The backup's JSON, or null when the password is wrong or the file was changed. Same contract as the web's decryptBackup. */
export async function decryptOnPhone(file: EncryptedBackup, password: string): Promise<string | null> {
  try {
    const key = await AESEncryptionKey.import(await deriveKey(password, file.kdf.salt, file.kdf.iterations))
    const sealed = AESSealedData.fromParts(file.cipher.iv, file.data, 16)
    const plain = await aesDecryptAsync(sealed, key, { output: 'bytes' })
    return new TextDecoder().decode(plain)
  } catch {
    return null
  }
}

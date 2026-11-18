/**
 * Password-protected backup files: the backup's JSON, encrypted with
 * AES-256-GCM under a key derived from the password (PBKDF2-SHA-256, a random
 * salt, many rounds). The file is useless without the password, and a
 * forgotten password can't be recovered. Plain backups stay plain JSON.
 */

export const ENCRYPTED_FORMAT = '75hard-encrypted-backup'
export const BACKUP_KDF_ITERATIONS = 310_000

export interface EncryptedBackup {
  format: typeof ENCRYPTED_FORMAT
  version: 1
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string }
  cipher: { name: 'AES-GCM'; iv: string }
  /** The encrypted backup JSON, base64. */
  data: string
}

export function isEncryptedBackup(value: unknown): value is EncryptedBackup {
  if (typeof value !== 'object' || value === null) return false
  const file = value as Partial<EncryptedBackup>
  return (
    file.format === ENCRYPTED_FORMAT &&
    typeof file.data === 'string' &&
    typeof file.kdf?.salt === 'string' &&
    typeof file.kdf?.iterations === 'number' &&
    typeof file.cipher?.iv === 'string'
  )
}

/** Base64 for large buffers (a backup holds every photo), in chunks to stay within call-stack limits. */
function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptBackup(
  json: string,
  password: string,
  iterations: number = BACKUP_KDF_ITERATIONS,
): Promise<EncryptedBackup> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt, iterations)
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(json))
  return {
    format: ENCRYPTED_FORMAT,
    version: 1,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: toBase64(salt) },
    cipher: { name: 'AES-GCM', iv: toBase64(iv) },
    data: toBase64(new Uint8Array(data)),
  }
}

/** The backup JSON, or null when the password is wrong (or the file was altered). */
export async function decryptBackup(file: EncryptedBackup, password: string): Promise<string | null> {
  try {
    const key = await deriveKey(password, fromBase64(file.kdf.salt), file.kdf.iterations)
    const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(file.cipher.iv) }, key, fromBase64(file.data))
    return new TextDecoder().decode(data)
  } catch {
    return null
  }
}

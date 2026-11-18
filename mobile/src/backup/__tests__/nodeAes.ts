import { createDecipheriv } from 'node:crypto'

// expo-crypto's AES is native code. In tests Node's AES-256-GCM stands in for it, with the same
// inputs: a raw key, a base64 IV, and base64 ciphertext with the 16-byte tag at its end.
// Use with: jest.mock('expo-crypto', () => jest.requireActual('./nodeAes'))
export const AESEncryptionKey = { import: async (bytes: Uint8Array) => ({ bytes }) }

export const AESSealedData = {
  fromParts: (iv: string, data: string, tagLength: number) => ({
    iv: Buffer.from(iv, 'base64'),
    data: Buffer.from(data, 'base64'),
    tagLength,
  }),
}

export async function aesDecryptAsync(
  sealed: { iv: Buffer; data: Buffer; tagLength: number },
  key: { bytes: Uint8Array },
): Promise<Uint8Array> {
  const decipher = createDecipheriv('aes-256-gcm', key.bytes, sealed.iv)
  decipher.setAuthTag(sealed.data.subarray(-sealed.tagLength))
  const body = sealed.data.subarray(0, -sealed.tagLength)
  return new Uint8Array(Buffer.concat([decipher.update(body), decipher.final()]))
}

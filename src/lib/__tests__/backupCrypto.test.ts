import { describe, expect, it } from 'vitest'
import { decryptBackup, encryptBackup, isEncryptedBackup } from '../backupCrypto'

// Few rounds keep the tests fast; real backups use BACKUP_KDF_ITERATIONS.
const FAST = 1_000
const json = JSON.stringify({ version: 4, note: 'Prove I can finish what I start.', photo: 'x'.repeat(100_000) })

describe('backup encryption', () => {
  it('encrypts a backup so its content is unreadable, and decrypts it with the password', async () => {
    const file = await encryptBackup(json, 'duck-with-a-knife', FAST)
    expect(isEncryptedBackup(file)).toBe(true)
    expect(JSON.stringify(file)).not.toContain('Prove I can finish')
    expect(await decryptBackup(file, 'duck-with-a-knife')).toBe(json)
  })

  it('refuses a wrong password, and an altered file', async () => {
    const file = await encryptBackup(json, 'duck-with-a-knife', FAST)
    expect(await decryptBackup(file, 'duck-with-a-spoon')).toBeNull()

    const altered = { ...file, data: file.data.slice(0, -8) + 'AAAAAAA=' }
    expect(await decryptBackup(altered, 'duck-with-a-knife')).toBeNull()
  })

  it('tells protected files from plain backups', () => {
    expect(isEncryptedBackup(JSON.parse(json))).toBe(false)
    expect(isEncryptedBackup(null)).toBe(false)
  })
})

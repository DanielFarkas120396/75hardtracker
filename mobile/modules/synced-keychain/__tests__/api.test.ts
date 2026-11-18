/** @jest-environment node */
import * as expo from 'expo'

jest.mock('expo', () => ({ requireOptionalNativeModule: jest.fn() }))
const requireOptionalNativeModule = jest.mocked(expo.requireOptionalNativeModule)

/** Stands in for the Swift module: the keychain as a map. A missing item comes back as null, as Swift's nil does. */
function fakeNative() {
  const items = new Map<string, string>()
  return {
    setItem: async (key: string, value: string) => void items.set(key, value),
    getItem: async (key: string) => items.get(key) ?? null,
    removeItem: async (key: string) => void items.delete(key),
  }
}

function load(native: ReturnType<typeof fakeNative> | null) {
  requireOptionalNativeModule.mockReturnValue(native)
  let api!: typeof import('../index')
  jest.isolateModules(() => {
    api = require('../index') as typeof import('../index')
  })
  return api
}

it('asks for the Swift module by its name', () => {
  load(fakeNative())
  expect(requireOptionalNativeModule).toHaveBeenCalledWith('SyncedKeychain')
})

it('gives null for a key that was never set', async () => {
  const keychain = load(fakeNative())
  expect(keychain.isAvailable).toBe(true)
  expect(await keychain.getItem('missing')).toBeNull()
})

it('reads back what was written, and forgets what was removed', async () => {
  const keychain = load(fakeNative())
  await keychain.setItem('k', 'v1')
  await keychain.setItem('k', 'v2')
  expect(await keychain.getItem('k')).toBe('v2')
  await keychain.removeItem('k')
  expect(await keychain.getItem('k')).toBeNull()
})

it('says so where the Swift module is missing (Expo Go)', async () => {
  const keychain = load(null)
  expect(keychain.isAvailable).toBe(false)
  await expect(keychain.getItem('k')).rejects.toThrow('needs a development build')
  await expect(keychain.setItem('k', 'v')).rejects.toThrow('needs a development build')
  await expect(keychain.removeItem('k')).rejects.toThrow('needs a development build')
})

import { requireOptionalNativeModule } from 'expo'

/**
 * Small values in the iPhone's keychain, synced through iCloud Keychain (see
 * ios/SyncedKeychainModule.swift). It is Swift code of our own, so it exists
 * only in a development or store build, never in Expo Go.
 */
interface NativeKeychain {
  setItem(key: string, value: string): Promise<void>
  getItem(key: string): Promise<string | null>
  removeItem(key: string): Promise<void>
}

const native = requireOptionalNativeModule<NativeKeychain>('SyncedKeychain')

/** False in Expo Go, where the Swift module isn't there. */
export const isAvailable = native !== null

function keychain(): NativeKeychain {
  if (native === null) throw new Error('The synced keychain needs a development build: it is not in Expo Go.')
  return native
}

export async function setItem(key: string, value: string): Promise<void> {
  await keychain().setItem(key, value)
}

/** The stored value, or null when there is none (a first launch, or iCloud Keychain off on a new phone). */
export async function getItem(key: string): Promise<string | null> {
  return (await keychain().getItem(key)) ?? null
}

export async function removeItem(key: string): Promise<void> {
  await keychain().removeItem(key)
}

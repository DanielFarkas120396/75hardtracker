import * as LocalAuthentication from 'expo-local-authentication'

/**
 * Face ID through the phone's own prompt (expo-local-authentication). Nothing is stored: the phone's yes is the
 * whole check, as the web's passkey answer was. It is a privacy curtain over the app, not encryption.
 *
 * Expo Go can't show Face ID ("not supported in Expo Go"): it needs the development build. Without Face ID's usage
 * line the phone asks for its passcode instead.
 */

let authenticating = false

/** Whether the phone has Face ID (or Touch ID) set up. */
export async function isFaceIdAvailable(): Promise<boolean> {
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync())
  } catch {
    return false
  }
}

/** Asks for Face ID. Resolves to whether the owner was recognised (or typed the phone's passcode after failing). */
export async function askFaceId(promptMessage: string): Promise<boolean> {
  authenticating = true
  try {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage, cancelLabel: 'Cancel' })
    return result.success
  } catch {
    return false
  } finally {
    authenticating = false
  }
}

/** True while the Face ID prompt is up: it makes the app "inactive", which must not count as leaving it. */
export function isAuthenticating(): boolean {
  return authenticating
}

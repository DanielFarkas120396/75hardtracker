import { useState } from 'react'
import { SAVE_FAILED_LINE } from '../content/microcopy'
import { appLockRepo } from '../db/repositories/appLockRepo'
import { createLockCredential } from '../lib/appLock'
import { hashPin } from '../lib/pin'

/**
 * Setting up the app lock, as Settings and the onboarding offer both do:
 * turning it on with a PIN, changing the PIN, adding or removing Face ID.
 * Each action resolves to whether it worked; when it didn't, `error` says why.
 */
export function useLockSetup({ faceIdFailedLine }: { faceIdFailedLine: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /** Runs a save, which may resolve to the line to show when it didn't go through. */
  const run = async (save: () => Promise<string | void>): Promise<boolean> => {
    setBusy(true)
    setError(null)
    let failure: string | null
    try {
      failure = (await save()) ?? null
    } catch {
      failure = SAVE_FAILED_LINE
    }
    setBusy(false)
    setError(failure)
    return failure === null
  }

  return {
    busy,
    error,
    clearError: () => setError(null),
    turnOn: (pin: string) => run(async () => appLockRepo.enable(await hashPin(pin))),
    changePin: (pin: string) => run(async () => appLockRepo.setPin(await hashPin(pin))),
    /** Asks for Face ID to create the lock's passkey, under the player's name. */
    addFaceId: (name: string) =>
      run(async () => {
        const credentialId = await createLockCredential(name)
        if (!credentialId) return faceIdFailedLine
        await appLockRepo.setFaceId(credentialId)
      }),
    removeFaceId: () => run(() => appLockRepo.setFaceId(null)),
  }
}

import { SAVE_FAILED_LINE } from '@logic/microcopy'
import { useState } from 'react'
import { appLockRepo } from '../db/repositories/appLockRepo'
import { askFaceId } from './faceId'
import { hashPin } from './pin'

/**
 * Setting up the app lock, as Settings and the offer after the deal both do: turning it on with a PIN, changing the
 * PIN, adding or removing Face ID. Each action resolves to whether it worked; when it didn't, `error` says why. The
 * web's useLockSetup.
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
    /** Asks for Face ID once, so it is known to work before it guards the app. */
    addFaceId: () =>
      run(async () => {
        if (!(await askFaceId('Turn on Face ID for the app lock'))) return faceIdFailedLine
        await appLockRepo.setFaceId(true)
      }),
    removeFaceId: () => run(() => appLockRepo.setFaceId(false)),
  }
}

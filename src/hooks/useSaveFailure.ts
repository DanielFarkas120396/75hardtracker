import Dexie from 'dexie'
import { useCallback, useEffect, useState } from 'react'

const isSaveFailure = (reason: unknown) =>
  reason instanceof Dexie.DexieError || (reason instanceof DOMException && reason.name === 'QuotaExceededError')

/**
 * Failed saves, counted. Most writes are fired without waiting (tiles,
 * steppers, switches), so a failed one lands here as an unhandled rejection.
 * The count grows with each failure, so a repeat can restart the toast's timer.
 */
export function useSaveFailure(): { failures: number; dismiss: () => void } {
  const [failures, setFailures] = useState(0)

  useEffect(() => {
    const onRejection = (event: PromiseRejectionEvent) => {
      if (isSaveFailure(event.reason)) setFailures((count) => count + 1)
    }
    window.addEventListener('unhandledrejection', onRejection)
    return () => window.removeEventListener('unhandledrejection', onRejection)
  }, [])

  return { failures, dismiss: useCallback(() => setFailures(0), []) }
}

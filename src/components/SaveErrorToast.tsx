import Dexie from 'dexie'
import { useEffect, useState } from 'react'

const AUTO_DISMISS_MS = 6000

const isSaveFailure = (reason: unknown) =>
  reason instanceof Dexie.DexieError || (reason instanceof DOMException && reason.name === 'QuotaExceededError')

/** Most writes are fired without waiting (tiles, steppers, switches), so a failed one lands here as an unhandled rejection. */
export function SaveErrorToast() {
  const [failures, setFailures] = useState(0)

  useEffect(() => {
    const onRejection = (event: PromiseRejectionEvent) => {
      if (isSaveFailure(event.reason)) setFailures((count) => count + 1)
    }
    window.addEventListener('unhandledrejection', onRejection)
    return () => window.removeEventListener('unhandledrejection', onRejection)
  }, [])

  useEffect(() => {
    if (failures === 0) return
    const timer = setTimeout(() => setFailures(0), AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [failures])

  if (failures === 0) return null
  return (
    <div role="alert" className="pointer-events-none fixed inset-x-0 top-4 z-[70] flex justify-center px-4">
      <p className="w-full max-w-xs rounded-card bg-surface px-4 py-3 font-rounded text-sm font-semibold text-ink shadow-lg ring-1 ring-danger-ink">
        Couldn't save that. Try again. If it keeps happening, your phone may be full.
      </p>
    </div>
  )
}

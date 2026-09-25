import { Mascot } from './mascot/Mascot'

export type StorageProblem = 'failed' | 'blocked' | 'slow'

interface StorageErrorScreenProps {
  problem: StorageProblem
  error?: unknown
}

const COPY: Record<StorageProblem, { title: string; body: string }> = {
  failed: {
    title: 'Can’t open your data',
    body:
      '75 Hard Companion keeps everything on this device, in the browser’s storage — and the browser didn’t allow it. ' +
      'This usually means private browsing, or site data blocked in the browser’s settings. ' +
      'Open the app in a normal window, or allow storage for this site, then reload.',
  },
  blocked: {
    title: 'Finishing an update…',
    body: 'Another tab is still running the old version of the app. Close the other 75 Hard tabs and this one will continue.',
  },
  slow: {
    title: 'Still opening your data…',
    body: 'This is taking longer than usual. If it doesn’t finish, close any other tabs running the app and reload.',
  },
}

/** "Name: message" for anything error-like (DOMExceptions aren't always `instanceof Error`). */
function describeError(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const { name, message } = error as { name?: unknown; message?: unknown }
  return typeof name === 'string' && typeof message === 'string' ? `${name}: ${message}` : undefined
}

/** Shown instead of the app when the local database can't be opened. */
export function StorageErrorScreen({ problem, error }: StorageErrorScreenProps) {
  const { title, body } = COPY[problem]
  const detail = describeError(error)

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas p-6 text-center">
      <Mascot mood={problem === 'failed' ? 'sad' : 'waiting'} size={110} />
      <h1 className="font-rounded text-2xl font-extrabold text-ink">{title}</h1>
      <p className="max-w-sm font-rounded text-ink-muted">{body}</p>
      {detail && <p className="max-w-sm break-words font-mono text-xs text-ink-muted">{detail}</p>}
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="min-h-touch rounded-2xl border-b-4 border-ink/15 bg-surface px-6 py-3 font-rounded font-bold text-ink active:translate-y-1 active:border-b-0"
      >
        Reload
      </button>
    </div>
  )
}

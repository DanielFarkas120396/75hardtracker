import { useEffect, useState } from 'react'
import { subscribeToChanges } from './open'

/**
 * Reads from the database and rereads after every write, like
 * dexie-react-hooks' useLiveQuery in the web app: `undefined` until the first
 * read is back, and again a fresh read when `deps` change. A read that fails
 * is thrown while rendering, for the error boundary.
 */
export function useLiveQuery<T>(query: () => Promise<T>, deps: readonly unknown[]): T | undefined {
  const [state, setState] = useState<{ value?: T; error?: unknown }>({})

  useEffect(() => {
    let latest = 0
    let stopped = false
    const read = () => {
      const mine = ++latest
      query().then(
        (value) => {
          // A slower, older read must not overwrite a newer one.
          if (!stopped && mine === latest) setState({ value })
        },
        (error: unknown) => {
          if (!stopped) setState({ error })
        },
      )
    }
    read()
    const stop = subscribeToChanges(read)
    return () => {
      stopped = true
      stop()
    }
    // The caller lists what the query depends on, as with dexie-react-hooks.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  if ('error' in state) throw state.error
  return state.value
}

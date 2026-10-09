import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react'
import { supportsWebGL } from '../../../lib/webgl'
import type { FillEngine } from './painter'

export const FillEngineContext = createContext<FillEngine | null>(null)

const noSubscription = () => () => {}

/**
 * Loads the board's fill engine; three.js comes with it, in its own chunk, after Today's first paint.
 * Null without WebGL, while it loads and while its context is lost: the tiles keep the thin bar meanwhile.
 */
export function useFillEngine(): FillEngine | null {
  const [engine, setEngine] = useState<FillEngine | null>(null)
  useEffect(() => {
    if (!supportsWebGL()) return
    let alive = true
    import('./engine')
      .then(({ sharedEngine }) => {
        if (alive) setEngine(sharedEngine())
      })
      // The fills are decoration: if three.js can't load or start, the tiles keep the thin bar.
      .catch((error: unknown) => console.warn('Tile fills off:', error))
    return () => {
      alive = false
    }
  }, [])
  const lost = useSyncExternalStore(engine?.subscribe ?? noSubscription, () => engine?.lost() ?? false)
  return engine && !lost ? engine : null
}

/** The engine the board above provides (null: no fills, the thin bar). */
export const useBoardFills = () => useContext(FillEngineContext)

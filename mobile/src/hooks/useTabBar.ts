import { useEffect, useSyncExternalStore } from 'react'

// How many things on screen want the tab bar out of the way (the camera sheet covers it on the web).
let hiders = 0
const listeners = new Set<() => void>()
const changed = (by: number) => {
  hiders += by
  for (const listener of [...listeners]) listener()
}

/** Hides the tab bar for as long as `hidden` is true and this component is on screen. */
export function useHideTabBar(hidden: boolean): void {
  useEffect(() => {
    if (!hidden) return
    changed(1)
    return () => changed(-1)
  }, [hidden])
}

/** Whether the tab bar should be hidden right now. Read by the tabs' layout. */
export function useTabBarHidden(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    () => hiders > 0,
  )
}

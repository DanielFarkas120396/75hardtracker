import { useEffect } from 'react'
import { applyWorld } from '../lib/worldTheme'
import type { WorldId } from '../screens/Journey/worlds'

/** Keeps <html data-world> on the given world. While it's unknown (loading), the no-flash script's choice stays. */
export function useWorldTheme(world: WorldId | undefined): void {
  useEffect(() => {
    if (world) applyWorld(world)
  }, [world])
}

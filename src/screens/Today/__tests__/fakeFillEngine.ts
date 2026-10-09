import type { FillEngine, FillHandle, LevelMode, PainterKind } from '../fills/painter'

export interface FakeHandle extends FillHandle {
  level: number
  moving: boolean
  /** Shows a level part-way, as a moving fill would. */
  show(level: number): void
  /** Ends the fill's animation at its level. */
  finish(): void
}

/** A stand-in engine (jsdom has no WebGL): only Water has a fill, and its fills move only when the test says so. */
export function fakeEngine(handles: FakeHandle[]): FillEngine {
  return {
    supports: (kind: PainterKind) => kind === 'wave',
    lost: () => false,
    subscribe: () => () => {},
    hold() {},
    add(_kind, _canvas, onFrame) {
      let shown = 0
      const handle: FakeHandle = {
        level: 0,
        moving: false,
        setLevel(level: number, mode: LevelMode) {
          handle.level = level
          handle.moving = mode === 'animate'
          if (!handle.moving) shown = level
          onFrame()
        },
        shown: () => shown,
        settledAt: () => (handle.moving ? null : handle.level),
        setAnchor() {},
        setImage() {},
        remove() {},
        show(level) {
          shown = level
          onFrame()
        },
        finish() {
          handle.moving = false
          shown = handle.level
          onFrame()
        },
      }
      handles.push(handle)
      return handle
    },
  }
}

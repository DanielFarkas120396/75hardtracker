import { useReducedMotion } from 'framer-motion'
import { useEffect, useEffectEvent, useLayoutEffect, useRef } from 'react'
import type { FillHandle, PainterKind } from './painter'
import { useBoardFills } from './useFillEngine'

interface TileFillProps {
  kind: PainterKind
  /** 0–1: taskFill. */
  level: number
  /** How finely the status counts up (76 steps of 50 ml for 3.8 L, 10 pages); none for tiles that don't count. */
  steps?: number
  /** The day's photo, for the iris. */
  image?: Blob
  onShown?: (level: number) => void
  /** The level the fill has settled at, or null while it moves. */
  onSettledAt: (level: number | null) => void
}

/** A tile's fill: a canvas under the tile's content, drawn by the board's engine. */
export function TileFill({ kind, level, steps, image, onShown, onSettledAt }: TileFillProps) {
  const engine = useBoardFills()
  const reduce = useReducedMotion() ?? false
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const handleRef = useRef<FillHandle | null>(null)
  const levelRef = useRef(level)
  const reported = useRef<{ shown: number | null; settled: number | null | undefined }>({ shown: null, settled: undefined })

  const report = useEffectEvent(() => {
    const handle = handleRef.current
    if (!handle) return
    if (steps && onShown) {
      const shown = Math.round(handle.shown() * steps) / steps
      if (shown !== reported.current.shown) {
        reported.current.shown = shown
        onShown(shown)
      }
    }
    const settled = handle.settledAt()
    if (settled !== reported.current.settled) {
      reported.current.settled = settled
      onSettledAt(settled)
    }
  })

  useLayoutEffect(() => {
    levelRef.current = level
  })

  // Made once per engine and kind, straight at the day's level: only changes animate.
  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!engine || !canvas) return
    const handle = engine.add(kind, canvas, () => report())
    handleRef.current = handle
    handle.setLevel(levelRef.current, 'instant')
    return () => {
      handle.remove()
      handleRef.current = null
    }
  }, [engine, kind])

  useLayoutEffect(() => {
    handleRef.current?.setLevel(level, reduce ? 'fade' : 'animate')
  }, [level, reduce])

  // The control the fill starts from (the chip, the switches), measured from the tile's right edge.
  useLayoutEffect(() => {
    const handle = handleRef.current
    const tile = canvasRef.current?.parentElement
    const anchor = tile?.querySelector<HTMLElement>('[data-fill-anchor]')
    if (!handle || !tile || !anchor) return
    const t = tile.getBoundingClientRect()
    const a = anchor.getBoundingClientRect()
    handle.setAnchor(t.right - (a.left + a.width / 2), a.top + a.height / 2 - t.top)
  })

  useEffect(() => {
    const handle = handleRef.current
    if (!handle || !image) return
    let alive = true
    let bitmap: ImageBitmap | undefined
    createImageBitmap(image, { imageOrientation: 'flipY' })
      .then((b) => {
        if (!alive) return b.close()
        bitmap = b
        handle.setImage(b)
      })
      .catch(() => {})
    return () => {
      alive = false
      handle.setImage(null)
      bitmap?.close()
    }
  }, [image, engine])

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />
}

import { useReducedMotionConfig } from 'framer-motion'
import { useEffect, useRef, useState, type RefObject } from 'react'

interface JourneyEffectsProps {
  /** The element the map scrolls in; the effects follow its scroll position and fill its visible height. */
  scrollRef: RefObject<HTMLElement | null>
}

function supportsWebGL(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2') ?? document.createElement('canvas').getContext('webgl')
    // Phones allow only a few WebGL contexts at once, so give this test one back straight away.
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return gl !== null
  } catch {
    return false
  }
}

/**
 * The world's moving particles (flames, sparks, ash, fireflies, leaves,
 * petals, snow, golden orbs), drawn with three.js on a canvas the size of
 * the visible map, stuck to the top of the scroll area. three.js loads only
 * here, on demand. Nothing runs under reduce motion or without WebGL.
 */
export function JourneyEffects({ scrollRef }: JourneyEffectsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reduceMotion = useReducedMotionConfig() ?? false
  const [height, setHeight] = useState(0)
  const [enabled] = useState(supportsWebGL)

  // The canvas covers exactly what's visible of the map.
  useEffect(() => {
    const scroller = scrollRef.current
    if (!scroller) return
    const update = () => setHeight(scroller.clientHeight)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(scroller)
    return () => observer.disconnect()
  }, [scrollRef])

  useEffect(() => {
    const canvas = canvasRef.current
    const scroller = scrollRef.current
    if (!enabled || reduceMotion || !canvas || !scroller) return
    let stopped = false
    let stop: (() => void) | undefined
    import('./renderer')
      .then(({ startEffects }) => {
        if (!stopped) stop = startEffects(canvas, scroller)
      })
      // Effects are decoration: if three.js can't load or start, the map simply goes without.
      .catch(() => {})
    return () => {
      stopped = true
      stop?.()
    }
  }, [enabled, reduceMotion, scrollRef])

  if (!enabled || reduceMotion) return null

  return (
    // A zero-height sticky strip: the canvas hangs from it over the visible part of the map.
    <div aria-hidden="true" className="pointer-events-none sticky top-0 z-[1] h-0">
      <canvas ref={canvasRef} className="block w-full" style={{ height }} />
    </div>
  )
}

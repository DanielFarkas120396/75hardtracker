import { useEffect, type RefObject } from 'react'
import type { Rig } from './rig'

/**
 * Tells the rig where fingers touch the screen, converted to the art's SVG
 * units, and when the page scrolls. There's no hover tracking: an iPhone has
 * none. A mouse only counts while a button is pressed, like a finger.
 */
export function useTouchGaze(svgRef: RefObject<SVGSVGElement | null>, rigRef: RefObject<Rig | null>): void {
  useEffect(() => {
    const look = (event: PointerEvent) => {
      const ctm = svgRef.current?.getScreenCTM?.()
      if (!ctm) return
      const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse())
      rigRef.current?.touch({ x: point.x, y: point.y })
    }
    const onMove = (event: PointerEvent) => {
      if (event.buttons !== 0) look(event)
    }
    const onScroll = () => rigRef.current?.scrolled()

    window.addEventListener('pointerdown', look, { passive: true })
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('pointerdown', look)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('scroll', onScroll)
    }
  }, [svgRef, rigRef])
}

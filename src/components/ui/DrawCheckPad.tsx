import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { isCheckmark, type Point } from '../../lib/checkmark'
import { Icon } from '../icons/Icon'

interface DrawCheckPadProps {
  /** Runs when the stroke on the pad becomes, or stops being, a checkmark. */
  onChange: (checked: boolean) => void
  disabled?: boolean
  /** The id of the line that says what to draw; it names the pad for assistive tech. */
  labelledBy: string
  className?: string
}

/** The pad's size, when the browser gives none (tests): the keyboard's checkmark is drawn into it. */
const FALLBACK_SIZE = { width: 320, height: 192 }

/** Over the pad's width and height, in fractions: the checkmark drawn for a keyboard or VoiceOver. */
const TYPED_CHECK: readonly [number, number][] = [
  [0.32, 0.48],
  [0.45, 0.72],
  [0.7, 0.26],
]

/**
 * A blank pad to sign on: one finger stroke, which counts once it reads as a
 * checkmark. A stroke that doesn't stays on the pad, with a word under it;
 * the next stroke replaces it, and × clears it. Enter or Space, from a
 * keyboard or VoiceOver, draws the checkmark, so nobody is locked out.
 */
export function DrawCheckPad({ onChange, disabled = false, labelledBy, className = '' }: DrawCheckPadProps) {
  const [points, setPoints] = useState<Point[]>([])
  const [status, setStatus] = useState<'blank' | 'drawing' | 'checked' | 'missed'>('blank')
  // The stroke being drawn, as a ref: React may not have rendered the last moves when the finger lifts.
  const stroke = useRef<Point[]>([])
  const drawing = useRef(false)
  const frame = useRef<HTMLDivElement>(null)
  const statusId = useId()

  // iOS Safari doesn't always honour touch-action on an SVG: the page scrolls under the finger
  // and the stroke is cancelled. Stopping the touch itself while drawing holds the page still.
  useEffect(() => {
    const el = frame.current
    if (!el) return
    const hold = (event: TouchEvent) => {
      if (drawing.current) event.preventDefault()
    }
    el.addEventListener('touchmove', hold, { passive: false })
    return () => el.removeEventListener('touchmove', hold)
  }, [])

  const settle = (drawn: Point[]) => {
    stroke.current = drawn
    setPoints(drawn)
    const checked = isCheckmark(drawn)
    setStatus(checked ? 'checked' : 'missed')
    onChange(checked)
  }

  const clear = () => {
    drawing.current = false
    stroke.current = []
    setPoints([])
    setStatus('blank')
    onChange(false)
  }

  const at = (event: PointerEvent<SVGSVGElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (disabled || event.button !== 0) return
    drawing.current = true
    event.currentTarget.setPointerCapture?.(event.pointerId)
    stroke.current = [at(event)]
    setPoints(stroke.current)
    setStatus('drawing')
    onChange(false)
  }

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!drawing.current) return
    stroke.current = [...stroke.current, at(event)]
    setPoints(stroke.current)
  }

  const onPointerUp = (event: PointerEvent<SVGSVGElement>) => {
    if (!drawing.current) return
    drawing.current = false
    settle([...stroke.current, at(event)])
  }

  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if (disabled || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    settle(typedStroke(rect.width || FALLBACK_SIZE.width, rect.height || FALLBACK_SIZE.height))
  }

  const path = points.length ? `M${points.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ')}` : ''
  const line = status === 'missed' ? 'Not quite a checkmark. Try again.' : status === 'checked' ? 'Signed.' : ''

  return (
    <div className={className}>
      <div
        ref={frame}
        className="relative h-48 w-full touch-none overflow-hidden rounded-card border border-ink/15 bg-surface [-webkit-touch-callout:none]"
      >
        <svg
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-labelledby={labelledBy}
          aria-describedby={statusId}
          aria-disabled={disabled || undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
          onContextMenu={(e) => e.preventDefault()}
          className="absolute inset-0 h-full w-full touch-none select-none text-ink [-webkit-touch-callout:none] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink"
        >
          <path d={path} fill="none" stroke="currentColor" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {points.length > 0 && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear the drawing"
            className="absolute bottom-2 left-2 flex min-h-touch min-w-touch touch-manipulation items-center justify-center rounded-full text-ink-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
          >
            <Icon name="close" size={22} />
          </button>
        )}
      </div>
      <p id={statusId} aria-live="polite" className="mt-2 min-h-5 text-sm text-ink-muted">
        {line}
      </p>
    </div>
  )
}

/** A checkmark that fills the pad, sampled like a finger would draw it. */
function typedStroke(width: number, height: number): Point[] {
  const corners = TYPED_CHECK.map(([x, y]) => ({ x: x * width, y: y * height }))
  const stroke: Point[] = []
  for (let i = 0; i < corners.length - 1; i++) {
    const a = corners[i]
    const b = corners[i + 1]
    for (let s = 0; s < 12; s++) stroke.push({ x: a.x + ((b.x - a.x) * s) / 12, y: a.y + ((b.y - a.y) * s) / 12 })
  }
  stroke.push(corners[corners.length - 1])
  return stroke
}

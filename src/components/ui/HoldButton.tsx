import { useReducedMotionConfig } from 'framer-motion'
import { useEffect, useId, useRef, useState, type PointerEvent } from 'react'

/** How long the press has to last. */
export const HOLD_MS = 1000

/** Shown, and announced, when the finger lets go before HOLD_MS. */
export const KEEP_HOLDING_LINE = 'Keep holding.'

/** A click this soon after a press ended is that press's own click. */
const CLICK_AFTER_PRESS_MS = 500

interface HoldButtonProps {
  /** Runs once the press has lasted HOLD_MS, or at once from a keyboard or VoiceOver. */
  onCommit: () => void
  disabled?: boolean
  children: string
  /** Under the button, linked to it: says how it works. */
  hint?: string
  className?: string
}

/**
 * The world's main button, held instead of tapped: for a promise, not a step.
 * A fill runs across while the finger stays down; letting go early cancels,
 * and says to keep holding. The press is captured, so a finger that drifts
 * off the button doesn't cancel it. A click that no press started (keyboard,
 * Switch Control, VoiceOver) commits straight away, so nobody is locked out.
 */
export function HoldButton({ onCommit, disabled = false, children, hint, className = '' }: HoldButtonProps) {
  const [holding, setHolding] = useState(false)
  const [releasedEarly, setReleasedEarly] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // When the last press ended: a click right after it is that press's own, and the hold decides, not the click.
  const pressEndedAt = useRef(-Infinity)
  const hintId = useId()
  // Reduce motion: the fill still shows progress, in a few still steps.
  const reduceMotion = useReducedMotionConfig() ?? false

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }

  useEffect(() => clearTimer, [])
  // Disabled mid-press (saving started, midnight passed): the press can't commit any more.
  useEffect(() => {
    if (disabled) clearTimer()
  }, [disabled])

  const filling = holding && !disabled

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (disabled || event.button !== 0) return
    // Keeps the pointer events on the button even if the finger slides off it.
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setHolding(true)
    setReleasedEarly(false)
    timer.current = setTimeout(() => {
      timer.current = null
      setHolding(false)
      onCommit()
    }, HOLD_MS)
  }

  const onPointerUp = () => {
    if (timer.current) setReleasedEarly(true)
    pressEndedAt.current = performance.now()
    clearTimer()
    setHolding(false)
  }

  const onPointerCancel = () => {
    clearTimer()
    setHolding(false)
  }

  const onClick = () => {
    const pressesOwnClick = holding || performance.now() - pressEndedAt.current < CLICK_AFTER_PRESS_MS
    if (!disabled && !pressesOwnClick) onCommit()
  }

  const shownHint = releasedEarly && !disabled ? KEEP_HOLDING_LINE : hint

  return (
    <div className={className}>
      <button
        type="button"
        disabled={disabled}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onClick={onClick}
        onContextMenu={(e) => e.preventDefault()}
        aria-describedby={shownHint ? hintId : undefined}
        className="relative min-h-touch w-full touch-manipulation select-none overflow-hidden rounded-2xl border-b-4 border-world-edge bg-world px-6 py-4 font-rounded text-xl font-extrabold text-on-world [-webkit-touch-callout:none] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:border-ink/10 disabled:bg-ink/10 disabled:text-ink-muted"
      >
        <span
          aria-hidden="true"
          data-testid="hold-fill"
          className="absolute inset-0 origin-left bg-world-edge"
          style={{
            transform: `scaleX(${filling ? 1 : 0})`,
            transitionProperty: 'transform',
            transitionDuration: filling ? `${HOLD_MS}ms` : '150ms',
            transitionTimingFunction: filling ? (reduceMotion ? 'steps(5, end)' : 'linear') : 'ease-out',
          }}
        />
        <span className="relative">{children}</span>
      </button>
      {shownHint && (
        <p
          id={hintId}
          aria-live="polite"
          className={`mt-2 text-sm ${releasedEarly && !disabled ? 'font-semibold text-ink' : 'text-ink-muted'}`}
        >
          {shownHint}
        </p>
      )}
    </div>
  )
}

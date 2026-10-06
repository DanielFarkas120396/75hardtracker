import { useReducedMotionConfig } from 'framer-motion'
import { useEffect, useId, useRef, useState, type MouseEvent, type PointerEvent } from 'react'

/** How long the press has to last. */
export const HOLD_MS = 1000

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
 * A fill runs across while the finger stays down; letting go early cancels.
 * A click without a press (keyboard, Switch Control, VoiceOver's double-tap
 * on desktop) commits straight away, so nobody is locked out.
 */
export function HoldButton({ onCommit, disabled = false, children, hint, className = '' }: HoldButtonProps) {
  const [holding, setHolding] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hintId = useId()
  // Reduce motion: the fill still shows progress, in a few still steps.
  const reduceMotion = useReducedMotionConfig() ?? false

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }

  const stop = () => {
    clearTimer()
    setHolding(false)
  }

  useEffect(() => clearTimer, [])
  // Disabled mid-press (saving started, midnight passed): the press can't commit any more.
  useEffect(() => {
    if (disabled) clearTimer()
  }, [disabled])

  const filling = holding && !disabled

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (disabled || event.button !== 0) return
    setHolding(true)
    timer.current = setTimeout(() => {
      timer.current = null
      setHolding(false)
      onCommit()
    }, HOLD_MS)
  }

  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    // A tap's own click does nothing: the hold commits. detail is 0 for a click no pointer made (Enter, Space, assistive tech).
    if (!disabled && event.detail === 0) onCommit()
  }

  return (
    <div className={className}>
      <button
        type="button"
        disabled={disabled}
        onPointerDown={onPointerDown}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        onClick={onClick}
        onContextMenu={(e) => e.preventDefault()}
        aria-describedby={hint ? hintId : undefined}
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
      {hint && (
        <p id={hintId} className="mt-2 text-sm text-ink-muted">
          {hint}
        </p>
      )}
    </div>
  )
}

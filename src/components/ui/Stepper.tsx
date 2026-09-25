interface StepperProps {
  value: number
  /**
   * Called with a signed delta (+step / -step) rather than the resulting
   * value — callers should apply it atomically (e.g. a Dexie `.modify()`)
   * so rapid taps can't be lost to a stale `value` prop.
   */
  onStep: (delta: number) => void
  step?: number
  min?: number
  max?: number
  unit?: string
}

/** A +/- numeric stepper used for workout minutes, reading pages, etc. */
export function Stepper({ value, onStep, step = 1, min = 0, max = Infinity, unit }: StepperProps) {
  const decrement = () => onStep(-step)
  const increment = () => onStep(step)

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={decrement}
        disabled={value <= min}
        className="flex h-11 w-11 items-center justify-center rounded-xl border-b-4 border-ink/15 bg-canvas text-xl font-bold text-ink active:translate-y-1 active:border-b-0 disabled:opacity-40"
        aria-label="Decrease"
      >
        −
      </button>
      <span className="min-w-16 text-center font-rounded text-xl font-extrabold text-ink">
        {value}
        {unit ? <span className="ml-1 text-sm font-semibold text-ink-muted">{unit}</span> : null}
      </span>
      <button
        type="button"
        onClick={increment}
        disabled={value >= max}
        className="flex h-11 w-11 items-center justify-center rounded-xl border-b-4 border-green-dark bg-green text-xl font-bold text-on-accent active:translate-y-1 active:border-b-0 disabled:opacity-40"
        aria-label="Increase"
      >
        +
      </button>
    </div>
  )
}

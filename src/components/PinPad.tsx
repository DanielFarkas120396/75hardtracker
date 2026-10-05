import { useState, type ReactNode } from 'react'
import { PIN_LENGTH } from '../lib/pin'
import { Icon } from './icons/Icon'

interface PinPadProps {
  title: string
  /** Shown under the dots, in red (a wrong PIN, a mismatch). */
  error?: string | null
  /** Shown under the dots when there's no error (a countdown, a hint). */
  hint?: string | null
  disabled?: boolean
  /** Called once all digits are typed; the pad then clears itself. */
  onComplete: (pin: string) => void
  /** The bottom-left key, e.g. Face ID. */
  extraKey?: ReactNode
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

/** A banking-app style PIN pad: dots for the digits typed, big round keys, delete. */
export function PinPad({ title, error, hint, disabled = false, onComplete, extraKey }: PinPadProps) {
  const [digits, setDigits] = useState('')

  const press = (digit: string) => {
    if (disabled || digits.length >= PIN_LENGTH) return
    const next = digits + digit
    if (next.length === PIN_LENGTH) {
      setDigits('')
      onComplete(next)
    } else {
      setDigits(next)
    }
  }

  const key = 'flex h-16 w-16 items-center justify-center rounded-full font-rounded text-2xl font-bold touch-manipulation'

  return (
    <div className="flex flex-col items-center gap-4">
      <h2 className="font-rounded text-lg font-extrabold text-ink">{title}</h2>
      <div
        role="status"
        aria-label={`${digits.length} of ${PIN_LENGTH} digits entered`}
        className="flex gap-3"
      >
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span
            key={i}
            className={`h-3.5 w-3.5 rounded-full border-2 ${i < digits.length ? 'border-world bg-world' : error ? 'border-danger' : 'border-ink/30'}`}
          />
        ))}
      </div>
      <p
        role={error ? 'alert' : undefined}
        className={`min-h-5 max-w-xs text-center font-rounded text-sm font-semibold ${error ? 'text-danger-ink' : 'text-ink-muted'}`}
      >
        {error ?? hint ?? ''}
      </p>

      <div className="grid grid-cols-3 gap-x-6 gap-y-3">
        {KEYS.map((digit) => (
          <button
            key={digit}
            type="button"
            disabled={disabled}
            onClick={() => press(digit)}
            className={`${key} bg-surface text-ink shadow-sm active:bg-world-soft disabled:opacity-40`}
          >
            {digit}
          </button>
        ))}
        <span className="flex h-16 w-16 items-center justify-center">{extraKey}</span>
        <button
          type="button"
          disabled={disabled}
          onClick={() => press('0')}
          className={`${key} bg-surface text-ink shadow-sm active:bg-world-soft disabled:opacity-40`}
        >
          0
        </button>
        <button
          type="button"
          aria-label="Delete"
          disabled={disabled || digits.length === 0}
          onClick={() => setDigits(digits.slice(0, -1))}
          className={`${key} text-ink-muted disabled:opacity-30`}
        >
          <Icon name="chevron" size={26} className="rotate-180" />
        </button>
      </div>
    </div>
  )
}

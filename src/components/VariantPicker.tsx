import { useEffect, useRef } from 'react'
import { JOKER_DEFINITION, VARIANT_NAMES, VARIANT_SUMMARIES, VARIANT_TAGLINES, variantHighlights } from '../content/variants'
import { RULESETS, VARIANTS, type ChallengeVariant } from '../logic/rulesets'

interface VariantPickerProps {
  /** null: nothing picked yet. */
  value: ChallengeVariant | null
  onChange: (variant: ChallengeVariant) => void
  disabled?: boolean
}

/**
 * Radio group of the four challenges: a card per variant, with its name, a
 * tagline and the same three chips (workouts, weekly allowance, jokers). The
 * selected card also shows its full rules, and is scrolled into view when the
 * picker opens with it.
 */
export function VariantPicker({ value, onChange, disabled = false }: VariantPickerProps) {
  const selected = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    selected.current?.scrollIntoView?.({ block: 'nearest' })
    // Only on opening: a tapped card is in view already.
  }, [])

  return (
    <div role="radiogroup" aria-label="Challenge" className="flex flex-col gap-2">
      {VARIANTS.map((variant) => {
        const checked = variant === value
        const rules = RULESETS[variant]
        return (
          <button
            key={variant}
            ref={checked ? selected : undefined}
            type="button"
            role="radio"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => onChange(variant)}
            className={`min-h-touch w-full scroll-mb-28 rounded-2xl border p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-50 ${
              checked ? 'border-world-edge bg-world-soft ring-2 ring-world-edge' : 'border-ink/15 bg-canvas'
            }`}
          >
            <span className="block font-rounded text-lg font-bold text-ink">{VARIANT_NAMES[variant]}</span>
            <span className={`block text-sm font-bold ${checked ? 'text-world-ink' : 'text-ink-muted'}`}>
              {VARIANT_TAGLINES[variant]}
            </span>
            <span className="mt-2 flex flex-wrap gap-1.5">
              {variantHighlights(rules).map((highlight) => (
                <span key={highlight} className="rounded-full bg-surface px-2.5 py-0.5 font-rounded text-xs font-bold text-ink">
                  {highlight}
                </span>
              ))}
            </span>
            {checked && (
              <span className="mt-2 block text-xs text-ink-muted">
                {rules.jokers > 0 && `${JOKER_DEFINITION} `}
                {VARIANT_SUMMARIES[variant]}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

import { VARIANT_NAMES, VARIANT_SUMMARIES, VARIANT_TAGLINES, variantHighlights } from '../content/variants'
import { RULESETS, VARIANTS, type ChallengeVariant } from '../logic/rulesets'

interface VariantPickerProps {
  value: ChallengeVariant
  onChange: (variant: ChallengeVariant) => void
  disabled?: boolean
}

/** Radio group of the four challenges: a card per variant, with its name, what sets it apart, and its rules. */
export function VariantPicker({ value, onChange, disabled = false }: VariantPickerProps) {
  return (
    <div role="radiogroup" aria-label="Challenge" className="flex flex-col gap-2">
      {VARIANTS.map((variant) => {
        const checked = variant === value
        return (
          <button
            key={variant}
            type="button"
            role="radio"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => onChange(variant)}
            className={`min-h-touch w-full rounded-2xl border p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-50 ${
              checked ? 'border-world-edge bg-world-soft ring-2 ring-world-edge' : 'border-ink/15 bg-canvas'
            }`}
          >
            <span className="block font-rounded text-lg font-extrabold text-ink">{VARIANT_NAMES[variant]}</span>
            <span className={`block text-sm font-bold ${checked ? 'text-world-ink' : 'text-ink-muted'}`}>
              {VARIANT_TAGLINES[variant]}
            </span>
            <span className="mt-2 flex flex-wrap gap-1.5">
              {variantHighlights(RULESETS[variant]).map((highlight) => (
                <span key={highlight} className="rounded-full bg-surface px-2.5 py-0.5 font-rounded text-xs font-bold text-ink">
                  {highlight}
                </span>
              ))}
            </span>
            <span className="mt-2 block text-xs text-ink-muted">{VARIANT_SUMMARIES[variant]}</span>
          </button>
        )
      })}
    </div>
  )
}

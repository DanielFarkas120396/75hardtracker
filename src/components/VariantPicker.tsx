import { VARIANT_NAMES, VARIANT_SUMMARIES } from '../content/variants'
import { VARIANTS, type ChallengeVariant } from '../logic/rulesets'

interface VariantPickerProps {
  value: ChallengeVariant
  onChange: (variant: ChallengeVariant) => void
  disabled?: boolean
}

/** Radio group of the four challenges: a card per variant, with its name and one-line summary. */
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
            className={`min-h-touch w-full rounded-2xl p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-50 ${
              checked ? 'ring-2 ring-green-ink bg-green-light' : 'bg-canvas'
            }`}
          >
            <span className="block font-rounded font-extrabold text-ink">{VARIANT_NAMES[variant]}</span>
            <span className="block text-sm text-ink-muted">{VARIANT_SUMMARIES[variant]}</span>
          </button>
        )
      })}
    </div>
  )
}

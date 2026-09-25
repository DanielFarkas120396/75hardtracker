import type { ReactNode } from 'react'

interface FieldProps {
  label: string
  unit?: string
  error?: string
  children: ReactNode
}

/** A labelled form field, with an optional unit after the label and an error message under the input. */
export function Field({ label, unit, error, children }: FieldProps) {
  return (
    <label className="mt-3 block">
      <span className="text-sm font-semibold text-ink-muted">
        {label}
        {unit && <span className="font-normal"> ({unit})</span>}
      </span>
      <span className="mt-1 block">{children}</span>
      {error && <span className="mt-1 block text-sm font-semibold text-danger-ink">{error}</span>}
    </label>
  )
}

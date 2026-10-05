import type { ReactNode } from 'react'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  /** A decoration before the label (an emoji); not part of the switch's name. */
  icon?: ReactNode
  /** The world's colour by default; blue where the task is about water or the outdoors. */
  activeColor?: 'world' | 'blue'
}

/** An accessible pill switch used for boolean tasks (diet followed, indoor/outdoor, etc.). */
export function Toggle({ checked, onChange, label, icon, activeColor = 'world' }: ToggleProps) {
  const activeClasses = activeColor === 'blue' ? 'bg-blue-ink' : 'bg-world-ink'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-touch w-full items-center justify-between gap-3 rounded-2xl bg-canvas px-4 py-3 text-left font-rounded font-bold text-ink"
    >
      <span className="flex items-center gap-2">
        {icon && (
          <span aria-hidden="true" className="text-xl leading-none">
            {icon}
          </span>
        )}
        {label}
      </span>
      <span
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full motion-safe:transition-colors ${checked ? activeClasses : 'bg-ink-muted'}`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-surface shadow motion-safe:transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`}
        />
      </span>
    </button>
  )
}

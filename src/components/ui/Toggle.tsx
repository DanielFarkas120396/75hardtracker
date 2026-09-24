interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  activeColor?: 'green' | 'blue'
}

/** An accessible pill switch used for boolean tasks (diet followed, indoor/outdoor, etc.). */
export function Toggle({ checked, onChange, label, activeColor = 'green' }: ToggleProps) {
  const activeClasses = activeColor === 'blue' ? 'bg-blue' : 'bg-green'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-touch w-full items-center justify-between gap-3 rounded-2xl bg-canvas px-4 py-3 text-left font-rounded font-bold text-ink"
    >
      <span>{label}</span>
      <span
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full motion-safe:transition-colors ${checked ? activeClasses : 'bg-ink/15'}`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow motion-safe:transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`}
        />
      </span>
    </button>
  )
}

import { useThemeSetting } from '../../hooks/useThemePreference'
import { THEME_PREFERENCES, type ThemePreference } from '../../lib/theme'

const LABELS: Record<ThemePreference, string> = {
  system: '🖥️ System',
  light: '☀️ Light',
  dark: '🌙 Dark',
}

/** Theme picker: follow the system, or force light or dark. */
export function AppearanceSection() {
  const { preference, setPreference } = useThemeSetting()

  return (
    <section className="rounded-card bg-surface p-4 shadow-sm">
      <h2 id="appearance-heading" className="font-rounded text-lg font-extrabold text-ink">
        🎨 Appearance
      </h2>
      <div role="radiogroup" aria-labelledby="appearance-heading" className="mt-3 grid grid-cols-3 gap-1 rounded-2xl bg-canvas p-1">
        {THEME_PREFERENCES.map((option) => {
          const selected = preference === option
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => void setPreference(option)}
              className={`min-h-touch rounded-xl px-2 font-rounded text-sm font-bold motion-safe:transition-colors ${
                selected ? 'bg-surface text-ink shadow-sm ring-1 ring-ink-muted' : 'text-ink-muted'
              }`}
            >
              {LABELS[option]}
            </button>
          )
        })}
      </div>
    </section>
  )
}

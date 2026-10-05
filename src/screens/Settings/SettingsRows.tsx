import type { ReactNode } from 'react'
import { Icon } from '../../components/icons/Icon'
import type { IconName } from '../../components/icons/icons'

/** A titled group of rows, like a section of iPhone Settings, with an optional note under it. */
export function SettingsGroup({ title, footer, children }: { title: string; footer?: string; children: ReactNode }) {
  return (
    <section aria-label={title}>
      <h2 className="mb-1.5 px-4 font-rounded text-xs font-extrabold tracking-wide text-ink-muted uppercase">{title}</h2>
      <div className="divide-y divide-ink/10 overflow-hidden rounded-card bg-surface shadow-sm ring-1 ring-ink/10 dark:divide-white/10 dark:ring-0">
        {children}
      </div>
      {footer && <p className="mt-1.5 px-4 font-rounded text-xs text-ink-muted">{footer}</p>}
    </section>
  )
}

interface SettingsRowProps {
  icon: IconName
  label: string
  /** The current value, shown muted before the chevron ("Dark", "22:30"). */
  value?: string
  onClick: () => void
  /** Red, for the danger zone; no chevron, since it opens a confirmation rather than a page. */
  danger?: boolean
}

/** A compact row: icon, label, current value and a chevron. Tapping it opens its page (or flow). */
export function SettingsRow({ icon, label, value, onClick, danger = false }: SettingsRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-touch w-full items-center gap-3 px-4 py-2.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink active:bg-ink/5"
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${danger ? 'bg-danger/15 text-danger-ink' : 'bg-world-soft text-world-ink'}`}
      >
        <Icon name={icon} size={20} />
      </span>
      <span className={`flex-1 font-rounded font-bold ${danger ? 'text-danger-ink' : 'text-ink'}`}>{label}</span>
      {value && <span className="max-w-[40%] truncate font-rounded text-sm font-semibold text-ink-muted">{value}</span>}
      {!danger && <Icon name="chevron" size={18} className="shrink-0 text-ink-muted" />}
    </button>
  )
}

/** A settings page opened from a row: a back button, its title, then its controls. */
export function SettingsPage({ title, onBack, children }: { title: string; onBack: () => void; children: ReactNode }) {
  return (
    <>
      <header className="px-4 pt-4 pb-3">
        <button
          type="button"
          onClick={onBack}
          className="-ml-2 flex min-h-touch items-center gap-1 rounded-xl px-2 font-rounded font-bold text-world-ink"
        >
          <Icon name="chevron" size={18} className="rotate-180" />
          Settings
        </button>
        <h1 className="font-display text-2xl tracking-wide text-ink">{title}</h1>
      </header>
      <main className="flex flex-col gap-4 px-4">{children}</main>
    </>
  )
}

import { Icon } from '../icons/Icon'
import type { IconName } from '../icons/icons'

export type ScreenId = 'today' | 'journey' | 'stats' | 'gallery' | 'settings'

const TABS: { id: ScreenId; label: string; icon: IconName }[] = [
  { id: 'today', label: 'Today', icon: 'today' },
  { id: 'journey', label: 'Journey', icon: 'journey' },
  { id: 'stats', label: 'Stats', icon: 'stats' },
  { id: 'gallery', label: 'Gallery', icon: 'gallery' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
]

interface BottomNavProps {
  active: ScreenId
  onChange: (id: ScreenId) => void
}

/**
 * A rounded bar floating above the bottom edge (and the iPhone's home
 * indicator). The active tab sits in a pill of the world's colour. Screens
 * leave room for it with their bottom padding (6.5rem plus the safe area).
 */
export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-[26rem] gap-1 rounded-[1.75rem] bg-surface p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.14)] ring-1 ring-ink/5 dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)] dark:ring-white/5"
    >
      {TABS.map((tab) => {
        const isActive = tab.id === active
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`flex min-h-touch flex-1 flex-col items-center justify-center gap-0.5 rounded-[1.25rem] py-1.5 font-rounded text-[0.6875rem] font-semibold motion-safe:transition-colors ${isActive ? 'bg-world-soft text-world-ink' : 'text-ink-muted'}`}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon name={tab.icon} size={22} />
            {tab.label}
          </button>
        )
      })}
    </nav>
  )
}

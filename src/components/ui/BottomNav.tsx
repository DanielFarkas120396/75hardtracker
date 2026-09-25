export type ScreenId = 'today' | 'journey' | 'stats' | 'gallery' | 'settings'

const TABS: { id: ScreenId; label: string; icon: string }[] = [
  { id: 'today', label: 'Today', icon: '✅' },
  { id: 'journey', label: 'Journey', icon: '🗺️' },
  { id: 'stats', label: 'Stats', icon: '📊' },
  { id: 'gallery', label: 'Gallery', icon: '📸' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
]

interface BottomNavProps {
  active: ScreenId
  onChange: (id: ScreenId) => void
}

export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md border-t border-ink/10 bg-surface pb-[env(safe-area-inset-bottom)]">
      {TABS.map((tab) => {
        const isActive = tab.id === active
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`flex min-h-touch flex-1 flex-col items-center justify-center gap-0.5 py-2 font-rounded text-xs font-bold motion-safe:transition-colors ${isActive ? 'text-green' : 'text-ink-muted'}`}
            aria-current={isActive ? 'page' : undefined}
          >
            <span className="text-xl" aria-hidden="true">
              {tab.icon}
            </span>
            {tab.label}
          </button>
        )
      })}
    </nav>
  )
}

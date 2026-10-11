import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useEffectEvent } from 'react'
import type { BadgeDefinition } from '../logic/badges'
import { Icon } from './icons/Icon'

interface BadgeUnlockToastProps {
  badges: BadgeDefinition[]
  /** Should be stable (e.g. from useCallback); it's called with the badge id. */
  onDismiss: (badgeId: string) => void
}

const AUTO_DISMISS_MS = 4500
/** Beyond this, toasts wait their turn: a backup restore or a catch-up can unlock many badges at once. */
const MAX_VISIBLE = 2

/** Stacked "Badge unlocked" toasts, a couple at a time; each dismisses itself after a few seconds. Sits above the celebration overlay. */
export function BadgeUnlockToast({ badges, onDismiss }: BadgeUnlockToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4"
    >
      <AnimatePresence>
        {badges.slice(0, MAX_VISIBLE).map((badge) => (
          <ToastItem key={badge.id} badge={badge} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  )
}

function ToastItem({ badge, onDismiss }: { badge: BadgeDefinition; onDismiss: (badgeId: string) => void }) {
  // The timer starts once per toast; parent re-renders (every tap on Today)
  // must not restart it, so it reads the latest callback through an effect event.
  const dismiss = useEffectEvent(() => onDismiss(badge.id))

  useEffect(() => {
    const timer = setTimeout(dismiss, AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [badge.id])

  return (
    <motion.div
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -40, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      className="pointer-events-auto flex w-full max-w-xs items-center gap-3 rounded-card bg-surface px-4 py-3 shadow-lg ring-1 ring-world/30"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-world-soft text-world-ink">
        <Icon name="badge" size={20} />
      </span>
      <div>
        <p className="font-rounded text-sm font-bold text-ink">Badge unlocked: {badge.name}</p>
        <p className="font-rounded text-xs font-semibold text-ink-muted">{badge.description}</p>
      </div>
    </motion.div>
  )
}

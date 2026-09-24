import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useEffectEvent } from 'react'
import type { BadgeDefinition } from '../logic/badges'

interface BadgeUnlockToastProps {
  badges: BadgeDefinition[]
  /** Should be stable (e.g. from useCallback); it's called with the badge id. */
  onDismiss: (badgeId: string) => void
}

const AUTO_DISMISS_MS = 4500

/** Stacked "Badge unlocked" toasts; each dismisses itself after a few seconds. Sits above the celebration overlay. */
export function BadgeUnlockToast({ badges, onDismiss }: BadgeUnlockToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4"
    >
      <AnimatePresence>
        {badges.map((badge) => (
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
      className="pointer-events-auto flex w-full max-w-xs items-center gap-3 rounded-2xl border-b-4 border-yellow-dark bg-yellow px-4 py-3 shadow-md"
    >
      <span className="text-2xl" role="img" aria-label="badge">
        🏅
      </span>
      <div>
        <p className="font-rounded text-sm font-extrabold text-ink">Badge unlocked: {badge.name}</p>
        <p className="font-rounded text-xs font-semibold text-ink/70">{badge.description}</p>
      </div>
    </motion.div>
  )
}

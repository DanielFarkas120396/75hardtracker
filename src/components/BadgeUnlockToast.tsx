import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
import type { BadgeDefinition } from '../logic/badges'

interface BadgeUnlockToastProps {
  badges: BadgeDefinition[]
  onDismiss: (id: string) => void
}

const AUTO_DISMISS_MS = 4500

export function BadgeUnlockToast({ badges, onDismiss }: BadgeUnlockToastProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {badges.map((badge) => (
          <ToastItem key={badge.id} badge={badge} onDismiss={() => onDismiss(badge.id)} />
        ))}
      </AnimatePresence>
    </div>
  )
}

function ToastItem({ badge, onDismiss }: { badge: BadgeDefinition; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [onDismiss])

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

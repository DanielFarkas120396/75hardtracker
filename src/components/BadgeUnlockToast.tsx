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
/** Quicker while others wait behind: a backup restore or a catch-up can unlock many badges at once. */
const AUTO_DISMISS_QUEUED_MS = 3000
/** The front toast and the ones peeking out behind it. */
const STACK_DEPTH = 3
/** How far each card behind sits below the one in front of it, and how much smaller it is. */
const PEEK_PX = 9
const PEEK_SCALE = 0.05

/**
 * "Badge unlocked" toasts as one stack, pinned to the top: the first in
 * front, the next ones peeking out behind it. Only the front one counts
 * down; a tap sends it away early, and the next slides forward. Sits above
 * the celebration overlay.
 */
export function BadgeUnlockToast({ badges, onDismiss }: BadgeUnlockToastProps) {
  const frontId = badges[0]?.id
  const dismissFront = useEffectEvent((id: string) => onDismiss(id))

  // One timer, for the front toast only; it restarts when a new toast comes forward,
  // not on parent re-renders (every tap on Today).
  const queued = badges.length > 1
  useEffect(() => {
    if (!frontId) return
    const timer = setTimeout(() => dismissFront(frontId), queued ? AUTO_DISMISS_QUEUED_MS : AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [frontId, queued])

  return (
    <div
      role="status"
      aria-live="polite"
      // Below the status bar and the Dynamic Island, not under them.
      className="pointer-events-none fixed inset-x-0 top-[calc(1rem+env(safe-area-inset-top))] z-[60] flex justify-center px-4"
    >
      {/* One grid cell: the cards lie on top of each other. */}
      <div className="grid w-full max-w-xs">
        <AnimatePresence initial={false}>
          {badges.slice(0, STACK_DEPTH).map((badge, depth) => (
            <motion.button
              key={badge.id}
              type="button"
              aria-hidden={depth > 0}
              tabIndex={depth > 0 ? -1 : 0}
              aria-label={depth === 0 ? `Badge unlocked: ${badge.name}. ${badge.description} Tap to dismiss.` : undefined}
              onClick={depth === 0 ? () => onDismiss(badge.id) : undefined}
              initial={{ y: -40, opacity: 0, scale: 1 }}
              animate={{ y: depth * PEEK_PX, scale: 1 - depth * PEEK_SCALE, opacity: depth === 0 ? 1 : 0.75 - (depth - 1) * 0.25 }}
              exit={{ y: -40, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
              style={{ zIndex: STACK_DEPTH - depth, transformOrigin: 'top center' }}
              // The cards behind are empty and stretch to the front card's height, so every edge peeks out the same.
              className={`flex w-full items-center gap-3 rounded-card bg-surface px-4 py-3 text-left shadow-lg ring-1 ring-world/30 [grid-area:1/1] ${
                depth === 0 ? 'pointer-events-auto self-start' : 'self-stretch'
              }`}
            >
              {depth === 0 && (
                <>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-world-soft text-world-ink">
                    <Icon name="badge" size={20} />
                  </span>
                  <span>
                    <span className="block font-rounded text-sm font-bold text-ink">Badge unlocked: {badge.name}</span>
                    <span className="block font-rounded text-xs font-semibold text-ink-muted">{badge.description}</span>
                  </span>
                </>
              )}
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

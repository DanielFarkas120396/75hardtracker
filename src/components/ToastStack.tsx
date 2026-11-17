import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useEffectEvent } from 'react'
import { Icon } from './icons/Icon'

export interface Toast {
  id: string
  title: string
  detail?: string
  /** A failure: drawn in the danger colour and announced at once. */
  error?: boolean
  /** How long it stays in front before going away on its own. */
  durationMs: number
  /** Bumped when the same toast fires again, so its timer starts over. */
  stamp?: number
}

interface ToastStackProps {
  /** In order: the first is in front. */
  toasts: Toast[]
  /** Should be stable (e.g. from useCallback). */
  onDismiss: (id: string) => void
}

/** Quicker while others wait behind: a backup restore or a catch-up can unlock many badges at once. */
const QUEUED_MAX_MS = 3000
/** The front toast and the ones peeking out behind it. */
const STACK_DEPTH = 3
/** How far each card behind sits below the one in front of it, and how much smaller it is. */
const PEEK_PX = 9
const PEEK_SCALE = 0.05

/**
 * The app's toasts as one stack, pinned to the top: the first in front, the
 * next ones peeking out behind it as empty edges of the front card's height.
 * Only the front one counts down; a tap sends it away early, and the next
 * slides forward. Sits above the celebration overlay and the lock screen.
 */
export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  const front = toasts[0]
  const queued = toasts.length > 1
  const dismissFront = useEffectEvent((id: string) => onDismiss(id))

  // One timer, for the front toast only; it restarts when a new toast comes forward
  // (or the same one fires again), not on parent re-renders (every tap on Today).
  const frontId = front?.id
  const frontStamp = front?.stamp
  const frontMs = front ? (queued ? Math.min(front.durationMs, QUEUED_MAX_MS) : front.durationMs) : 0
  useEffect(() => {
    if (!frontId) return
    const timer = setTimeout(() => dismissFront(frontId), frontMs)
    return () => clearTimeout(timer)
  }, [frontId, frontStamp, frontMs])

  return (
    <div
      role="status"
      aria-live="polite"
      // Below the status bar and the Dynamic Island, not under them.
      className="pointer-events-none fixed inset-x-0 top-[calc(1rem+env(safe-area-inset-top))] z-[70] flex justify-center px-4"
    >
      {/* One grid cell: the cards lie on top of each other. */}
      <div className="grid w-full max-w-xs">
        <AnimatePresence initial={false}>
          {toasts.slice(0, STACK_DEPTH).map((toast, depth) => (
            <motion.button
              key={toast.id}
              type="button"
              aria-hidden={depth > 0}
              tabIndex={depth > 0 ? -1 : 0}
              aria-label={depth === 0 ? `${toast.title}${toast.detail ? `. ${toast.detail}` : ''} Tap to dismiss.` : undefined}
              onClick={depth === 0 ? () => onDismiss(toast.id) : undefined}
              initial={{ y: -40, opacity: 0, scale: 1 }}
              animate={{ y: depth * PEEK_PX, scale: 1 - depth * PEEK_SCALE, opacity: depth === 0 ? 1 : 0.75 - (depth - 1) * 0.25 }}
              exit={{ y: -40, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
              style={{ zIndex: STACK_DEPTH - depth, transformOrigin: 'top center' }}
              // The cards behind are empty and stretch to the front card's height, so every edge peeks out the same.
              className={`flex w-full items-center gap-3 rounded-card bg-surface px-4 py-3 text-left shadow-lg ring-1 [grid-area:1/1] ${
                toast.error ? 'ring-danger-ink' : 'ring-world/30'
              } ${depth === 0 ? 'pointer-events-auto self-start' : 'self-stretch'}`}
            >
              {depth === 0 && (
                <>
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      toast.error ? 'bg-danger/10 text-danger-ink' : 'bg-world-soft text-world-ink'
                    }`}
                  >
                    <Icon name={toast.error ? 'warning' : 'badge'} size={20} />
                  </span>
                  <span role={toast.error ? 'alert' : undefined}>
                    <span className="block font-rounded text-sm font-bold text-ink">{toast.title}</span>
                    {toast.detail && <span className="block font-rounded text-xs font-semibold text-ink-muted">{toast.detail}</span>}
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

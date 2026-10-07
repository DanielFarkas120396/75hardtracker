import { AnimatePresence, motion, type DragControls, type TargetAndTransition } from 'framer-motion'
import { useEffect, useEffectEvent, useRef, type ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  /** A centred dialog (default), or a sheet anchored to the bottom edge that slides up. */
  placement?: 'center' | 'sheet'
  /** The id of the heading that names the dialog. */
  labelledBy?: string
  /** A centred dialog only: the point (in viewport pixels) it grows out of and shrinks back into. */
  from?: { x: number; y: number }
  /** Lets a handle inside the panel drag it down to close: the handle calls `start` on pointer down. */
  dragControls?: DragControls
}

const PANEL: Record<NonNullable<ModalProps['placement']>, { container: string; panel: string; closed: TargetAndTransition; open: TargetAndTransition }> = {
  center: {
    container: 'items-center justify-center p-6',
    panel: 'max-h-full w-full max-w-sm rounded-card p-6',
    closed: { scale: 0.9, opacity: 0 },
    open: { scale: 1, opacity: 1 },
  },
  sheet: {
    container: 'items-end justify-center',
    panel: 'max-h-[85dvh] w-full max-w-md rounded-t-[2.5rem] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]',
    closed: { y: '100%' },
    open: { y: 0 },
  },
}

/**
 * A dialog over a dimmed backdrop: centred, or a bottom sheet. Closes on
 * backdrop tap or Escape; scrolls when taller than its room. Focus moves to
 * the panel on open and back to what had it on close.
 */
export function Modal({ open, onClose, children, placement = 'center', labelledBy, from, dragControls }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const close = useEffectEvent(() => onClose())
  const look = PANEL[placement]
  // "Reduce motion" (the app's MotionConfig) drops the movement and keeps the fade.
  const grows = from !== undefined && placement === 'center'
  const closed = grows
    ? { x: from.x - window.innerWidth / 2, y: from.y - window.innerHeight / 2, scale: 0.05, opacity: 0 }
    : look.closed
  const opened = grows ? { x: 0, y: 0, scale: 1, opacity: 1 } : look.open

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement
    panelRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
    }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`fixed inset-0 z-50 flex bg-black/50 ${look.container}`}
          onClick={onClose}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            tabIndex={-1}
            initial={closed}
            animate={opened}
            exit={closed}
            {...(dragControls && {
              drag: 'y' as const,
              dragControls,
              dragListener: false,
              dragConstraints: { top: 0, bottom: 0 },
              dragElastic: { top: 0, bottom: 0.8 },
              onDragEnd: (_: unknown, info: { offset: { y: number }; velocity: { y: number } }) => {
                if (info.offset.y > 80 || info.velocity.y > 500) onClose()
              },
            })}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className={`overflow-y-auto bg-surface shadow-lg outline-none ${look.panel}`}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

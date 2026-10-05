import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useEffectEvent, useId, useRef, useState, type ReactNode } from 'react'
import { Icon } from '../../components/icons/Icon'
import { Burst } from '../../components/ui/Burst'
import { DoneBadge } from '../../components/ui/DoneBadge'
import { Modal } from '../../components/ui/Modal'
import { TASK_TITLES, type BoardTask } from '../../content/taskStatus'
import { useHaptics } from '../../hooks/useHaptics'
import { TASK_ICONS, TASK_TONES } from './taskTones'

export interface TaskSheetContent {
  task: BoardTask
  /** The day's rule for this task, under the title ("2 sessions of at least 45 minutes…"). */
  ruleLine: string
  complete: boolean
  /** Flashed when the task completes inside the sheet. */
  cheer?: string
  body: ReactNode
}

/** How long the cheer stays up before the sheet closes itself. */
export const CHEER_VISIBLE_MS = 1500

interface TaskSheetProps {
  /** The open task, or null when closed. */
  content: TaskSheetContent | null
  onClose: () => void
}

/**
 * The bottom sheet holding one task's controls, under a header in the task's
 * colour. When the task completes here, the header flips to done (tick,
 * cheer, a short buzz) and the sheet closes on its own after the cheer.
 */
export function TaskSheet({ content, onClose }: TaskSheetProps) {
  // The last content stays for the exit animation, after the host has let go of it.
  const last = useRef<TaskSheetContent | null>(null)
  if (content) last.current = content
  const shown = content ?? last.current
  const headingId = useId()

  return (
    <Modal open={content !== null} onClose={onClose} placement="sheet" labelledBy={headingId}>
      {shown && <SheetContent key={shown.task} content={shown} headingId={headingId} onClose={onClose} />}
    </Modal>
  )
}

function SheetContent({ content, headingId, onClose }: { content: TaskSheetContent; headingId: string; onClose: () => void }) {
  const { task, ruleLine, complete, cheer, body } = content
  const vibrate = useHaptics()
  const reduceMotion = useReducedMotion()
  const tone = TASK_TONES[task]

  // Compare with the previous render during render (React's "adjust state
  // when a prop changes" pattern). `justDone` counts switches to complete
  // since the sheet opened and keys each celebration; 0 means none (or undone).
  const [prevComplete, setPrevComplete] = useState(complete)
  const [justDone, setJustDone] = useState(0)
  if (prevComplete !== complete) {
    setPrevComplete(complete)
    setJustDone(complete ? justDone + 1 : 0)
  }

  const celebrate = useEffectEvent(() => vibrate(20))
  const close = useEffectEvent(() => onClose())
  useEffect(() => {
    if (justDone === 0) return
    celebrate()
    const timer = setTimeout(close, CHEER_VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [justDone])

  return (
    <>
      <header className={`relative -mx-5 -mt-5 rounded-t-[2.5rem] px-5 pt-5 pb-4 ${tone.tint}`}>
        <div className="flex items-start gap-3">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface ${tone.ink}`}>
            <Icon name={TASK_ICONS[task]} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={headingId} className="font-rounded text-xl font-extrabold text-ink">
              {TASK_TITLES[task]}
            </h2>
            <p className={`mt-0.5 text-sm font-semibold ${tone.ink}`}>{ruleLine}</p>
          </div>
          {complete && (
            <span className="relative mt-2 shrink-0">
              <DoneBadge pop={justDone > 0} />
              {justDone > 0 && !reduceMotion && <Burst key={justDone} className="top-0 left-0" />}
            </span>
          )}
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="-mt-1 -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <Icon name="close" size={20} />
          </button>
        </div>
        <div role="status" aria-live="polite" className="pointer-events-none absolute right-5 -bottom-3">
          <AnimatePresence>
            {justDone > 0 && cheer && (
              <motion.span
                key={justDone}
                initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="block whitespace-nowrap rounded-full bg-world px-3 py-1 font-rounded text-xs font-extrabold text-on-world shadow-sm"
              >
                {cheer}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </header>
      <div className="pt-5">{body}</div>
    </>
  )
}

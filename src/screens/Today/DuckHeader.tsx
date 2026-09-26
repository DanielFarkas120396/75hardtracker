import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Mascot, type DuckMood, type DuckReaction } from '../../components/mascot/Mascot'
import { registerPoke } from '../../components/mascot/rig'
import { duckLine, GLARE_LINE, LUNGE_LINE, pokeLine } from '../../content/microcopy'
import { useKnifeSound } from '../../hooks/useSound'
import { TASK_IDS } from '../../logic/dayCompletion'
import type { Menace, MenaceLevel } from '../../logic/menace'
import type { TaskId } from '../../logic/types'

/** How long a reaction's line stays up before his menace line returns. */
const REACTION_LINE_MS = 2200

const LEVEL_MOODS: Record<MenaceLevel, DuckMood> = {
  content: 'content',
  watching: 'watching',
  tapping: 'tapping',
  hunting: 'hunting',
}

/** A line and a reaction pushed in from outside, e.g. once a plan is saved. A new `id` shows it again. */
export interface DuckAnnouncement {
  text: string
  reaction: DuckReaction
  id: number
}

interface DuckHeaderProps {
  menace: Menace
  missing: readonly TaskId[]
  completion: Record<TaskId, boolean>
  dayNumber: number
  announcement?: DuckAnnouncement
  /** Three quick pokes make him lunge; the screen flashes red once. */
  onLunge: () => void
  /** Shown under the speech bubble: the plan button. */
  children?: ReactNode
}

/**
 * The Today screen's duck. His mood follows the menace; he answers pokes
 * (the third quick one makes him lunge), nods when a task is ticked, and
 * glares when one is unticked.
 */
export function DuckHeader({ menace, missing, completion, dayNumber, announcement, onLunge, children }: DuckHeaderProps) {
  const playShing = useKnifeSound()
  const [reaction, setReaction] = useState<{ kind: DuckReaction; id: number }>()
  const [override, setOverride] = useState<{ text: string; id: number }>()
  const pokes = useRef<number[]>([])
  const pokeCount = useRef(0)

  const react = (kind: DuckReaction, text?: string) => {
    setReaction((previous) => ({ kind, id: (previous?.id ?? 0) + 1 }))
    if (text !== undefined) setOverride((previous) => ({ text, id: (previous?.id ?? 0) + 1 }))
  }

  // React's "adjust state when a prop changes" pattern: compare with the previous render.
  const [seen, setSeen] = useState({ dayNumber, completion, announcement })
  if (seen.dayNumber !== dayNumber || seen.completion !== completion || seen.announcement !== announcement) {
    setSeen({ dayNumber, completion, announcement })
    if (announcement && announcement !== seen.announcement) {
      react(announcement.reaction, announcement.text)
    } else if (seen.dayNumber === dayNumber) {
      // A new day starts with nothing ticked; that isn't a task being unticked.
      if (TASK_IDS.some((task) => seen.completion[task] && !completion[task])) react('glare', GLARE_LINE)
      else if (TASK_IDS.some((task) => !seen.completion[task] && completion[task])) react('approve')
    }
  }

  useEffect(() => {
    if (!override) return
    const timer = setTimeout(() => setOverride(undefined), REACTION_LINE_MS)
    return () => clearTimeout(timer)
  }, [override])

  const poke = () => {
    const result = registerPoke(pokes.current, performance.now())
    pokes.current = result.recent
    playShing()
    if (result.kind === 'lunge') {
      react('lunge', LUNGE_LINE)
      onLunge()
    } else {
      react('poke', pokeLine(pokeCount.current))
      pokeCount.current += 1
    }
  }

  const line = override?.text ?? duckLine({ menace, missing, dayNumber })

  return (
    <div className="flex items-center gap-3 px-4 pb-4">
      <button
        type="button"
        onClick={poke}
        aria-label="Poke the duck"
        className="shrink-0 touch-manipulation rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <Mascot mood={LEVEL_MOODS[menace.level]} size={88} reaction={reaction} decorative />
      </button>
      <div className="flex min-w-0 flex-col items-start gap-2">
        <p className="relative rounded-2xl bg-surface px-4 py-2 font-rounded text-sm font-bold text-ink shadow-sm">
          <span aria-hidden="true" className="absolute top-1/2 -left-1.5 h-3 w-3 -translate-y-1/2 rotate-45 bg-surface" />
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={line}
              className="relative block"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
            >
              {line}
            </motion.span>
          </AnimatePresence>
        </p>
        {children}
      </div>
    </div>
  )
}

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { Mascot, type DuckMood, type DuckReaction } from '../../components/mascot/Mascot'
import { registerPoke } from '../../components/mascot/rig'
import { duckLine, GLARE_LINE, LUNGE_LINE, pokeLine } from '../../content/microcopy'
import { useKnifeSound } from '../../hooks/useSound'
import { TASK_IDS } from '../../logic/dayCompletion'
import type { Menace, MenaceLevel } from '../../logic/menace'
import type { TaskId } from '../../logic/types'

/** How long a reaction's line stays up before his menace line returns. */
const REACTION_LINE_MS = 2200
/** How long the bubble stays up each time it appears. */
export const LINE_VISIBLE_MS = 5000
/** How often the bubble comes back on its own, between changes of line. */
export const LINE_EVERY_MS = 45_000

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
  /** The player's name, for the line that starts the day. */
  name?: string
  /** Three quick pokes make him lunge; the screen flashes red once. */
  onLunge: () => void
}

/**
 * The Today screen's duck, in the corner of the hero. His mood follows the
 * menace; he answers pokes (the third quick one makes him lunge), nods when
 * a task is ticked, and glares when one is unticked. His line floats over
 * the hero in a bubble that shows for a few seconds whenever it changes,
 * and comes back now and then in between.
 */
export function DuckHeader({ menace, missing, completion, dayNumber, announcement, name, onLunge }: DuckHeaderProps) {
  const playShing = useKnifeSound()
  const reduceMotion = useReducedMotion()
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

  const line = override?.text ?? duckLine({ menace, missing, dayNumber, name })

  // The bubble shows for a while whenever the line changes (a new day, a
  // reaction, an announcement), and on its own every so often in between.
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), LINE_EVERY_MS)
    return () => clearInterval(id)
  }, [])
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    setVisible(true)
    const timer = setTimeout(() => setVisible(false), LINE_VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [line, tick])

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

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={poke}
        aria-label="Poke the duck"
        className="block touch-manipulation rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <Mascot mood={LEVEL_MOODS[menace.level]} size={72} reaction={reaction} decorative />
      </button>
      <AnimatePresence initial={false}>
        {visible && (
          <motion.p
            key="bubble"
            initial={{ opacity: 0, y: reduceMotion ? 0 : 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="absolute top-1 left-full z-10 ml-2 w-max max-w-[13rem] rounded-2xl bg-surface px-3 py-2 font-rounded text-sm font-bold text-ink shadow-md"
          >
            <span aria-hidden="true" className="absolute top-4 -left-1.5 h-3 w-3 rotate-45 bg-surface" />
            <span className="relative block">{line}</span>
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

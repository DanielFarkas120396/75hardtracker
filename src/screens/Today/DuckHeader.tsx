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

interface DuckProps {
  menace: Menace
  missing: readonly TaskId[]
  completion: Record<TaskId, boolean>
  dayNumber: number
  announcement?: DuckAnnouncement
  /** The player's name, for the line that starts the day. */
  name?: string
  /** Something is logged today, even if no task is done yet. */
  started?: boolean
  /** Yesterday can still be finished (until noon). */
  yesterdayOpen?: boolean
  /** Three quick pokes make him lunge; the screen flashes red once. */
  onLunge: () => void
}

/**
 * The Today screen's duck: `duck` sits in the hero's corner, `caption` is his
 * line, in its own row under the hero's top row so it never covers the day.
 * His mood follows the menace; he answers pokes (the third quick one makes
 * him lunge), nods when a task is ticked, and glares when one is unticked.
 * A reaction's line shows for a moment, then his menace line returns.
 */
export function useDuck({
  menace,
  missing,
  completion,
  dayNumber,
  announcement,
  name,
  started = false,
  yesterdayOpen = false,
  onLunge,
}: DuckProps): { duck: ReactNode; caption: ReactNode } {
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

  const line = override?.text ?? duckLine({ menace, missing, dayNumber, name, started, yesterdayOpen })

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

  return {
    duck: (
      <button
        type="button"
        onClick={poke}
        aria-label="Poke the duck"
        className="block shrink-0 touch-manipulation rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <Mascot mood={LEVEL_MOODS[menace.level]} size={64} reaction={reaction} decorative />
      </button>
    ),
    caption: (
      <p
        aria-live="polite"
        className="relative mt-3 line-clamp-2 rounded-2xl bg-surface px-3 py-2 font-rounded text-sm font-bold text-ink shadow-sm"
      >
        <span aria-hidden="true" className="absolute -top-1.5 left-6 h-3 w-3 rotate-45 bg-surface" />
        <span className="relative">{line}</span>
      </p>
    ),
  }
}

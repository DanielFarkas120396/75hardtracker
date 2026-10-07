import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from 'react'
import { Mascot, type DuckMood, type DuckReaction } from '../../components/mascot/Mascot'
import { registerPoke } from '../../components/mascot/rig'
import { duckLine, GLARE_LINE, LUNGE_LINE, nextCatchphrase, pokeLine } from '../../content/microcopy'
import { useKnifeSound } from '../../hooks/useSound'
import { TASK_IDS } from '../../logic/dayCompletion'
import type { Menace, MenaceLevel } from '../../logic/menace'
import type { TaskId } from '../../logic/types'

/** How long a line stays up once he's said it. */
export const SPEECH_MS = 4000
/** A reaction (a poke, a glare) is quicker. */
const REACTION_MS = 2500
/** He waits a beat after Today opens before he speaks. */
export const FIRST_LINE_DELAY_MS = 600
/** Between those moments he speaks up on his own, every so often: somewhere in this range. */
export const CHATTER_MIN_MS = 40_000
export const CHATTER_MAX_MS = 75_000

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
 * The Today screen's duck: `duck` sits beside the hero's ring, `speech` is the
 * bubble he talks in, rising above him. He speaks for a few seconds and falls quiet: when Today
 * opens, when his line changes (the day starts, a task is ticked, the clock
 * gets close), when he reacts (a poke, a glare, a saved plan), and now and
 * then on his own with one of his catchphrases. His mood follows the menace;
 * the third quick poke makes him lunge.
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
}: DuckProps): { duck: ReactNode; speech: ReactNode } {
  const playShing = useKnifeSound()
  const reduceMotion = useReducedMotion()
  const [reaction, setReaction] = useState<{ kind: DuckReaction; id: number }>()
  const [speech, setSpeech] = useState<{ text: string; ms: number; id: number } | null>(null)
  // What he said last, so a catchphrase never repeats it.
  const [lastSaid, setLastSaid] = useState<string>()
  const pokes = useRef<number[]>([])
  const pokeCount = useRef(0)

  const say = (text: string, ms = SPEECH_MS) => {
    setLastSaid(text)
    setSpeech((previous) => ({ text, ms, id: (previous?.id ?? 0) + 1 }))
  }

  const react = (kind: DuckReaction, text?: string) => {
    setReaction((previous) => ({ kind, id: (previous?.id ?? 0) + 1 }))
    if (text !== undefined) say(text, REACTION_MS)
  }

  const line = duckLine({ menace, missing, dayNumber, name, started, yesterdayOpen })

  // React's "adjust state when a prop changes" pattern: compare with the previous render.
  const [seen, setSeen] = useState({ dayNumber, completion, announcement, line })
  if (seen.dayNumber !== dayNumber || seen.completion !== completion || seen.announcement !== announcement || seen.line !== line) {
    setSeen({ dayNumber, completion, announcement, line })
    if (announcement && announcement !== seen.announcement) {
      react(announcement.reaction, announcement.text)
    } else if (seen.dayNumber === dayNumber && TASK_IDS.some((task) => seen.completion[task] && !completion[task])) {
      // A new day starts with nothing ticked; that isn't a task being unticked.
      react('glare', GLARE_LINE)
    } else {
      if (seen.dayNumber === dayNumber && TASK_IDS.some((task) => !seen.completion[task] && completion[task])) react('approve')
      if (seen.line !== line) say(line)
    }
  }

  // Each line falls quiet after its time.
  useEffect(() => {
    if (!speech) return
    const timer = setTimeout(() => setSpeech(null), speech.ms)
    return () => clearTimeout(timer)
  }, [speech])

  // The day's line, a beat after Today opens; then a catchphrase now and then.
  const greet = useEffectEvent(() => say(line))
  const chatter = useEffectEvent(() => say(nextCatchphrase(menace.level, lastSaid)))
  useEffect(() => {
    const first = setTimeout(greet, FIRST_LINE_DELAY_MS)
    let next: ReturnType<typeof setTimeout>
    const schedule = () => {
      next = setTimeout(
        () => {
          chatter()
          schedule()
        },
        CHATTER_MIN_MS + Math.random() * (CHATTER_MAX_MS - CHATTER_MIN_MS),
      )
    }
    schedule()
    return () => {
      clearTimeout(first)
      clearTimeout(next)
    }
  }, [])

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
    // Above the duck, rising from him, and narrow enough to stay in the space beside the ring, never over its count.
    // The caller places it in the duck's own box. Read by VoiceOver as he says it.
    speech: (
      <div aria-live="polite" className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 w-max max-w-[6rem]">
        <AnimatePresence>
          {speech && (
            <motion.p
              key={speech.id}
              initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.85, y: reduceMotion ? 0 : 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.95 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              style={{ transformOrigin: '2rem 100%' }}
              className="relative w-max max-w-full rounded-2xl bg-surface px-2.5 py-1.5 font-rounded text-xs font-bold leading-snug text-ink shadow-md"
            >
              <span aria-hidden="true" className="absolute -bottom-1.5 left-5 h-3 w-3 rotate-45 bg-surface" />
              <span className="relative">{speech.text}</span>
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    ),
  }
}

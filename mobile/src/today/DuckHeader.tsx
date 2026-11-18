import { TASK_IDS } from '@logic/dayCompletion'
import { registerPoke, type DuckMood, type DuckReaction } from '@logic/duckRig'
import type { Menace, MenaceLevel } from '@logic/menace'
import { duckLine, GLARE_LINE, LUNGE_LINE, nextCatchphrase, pokeLine } from '@logic/microcopy'
import type { TaskId } from '@logic/types'
import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from 'react'
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View } from 'react-native'
import { Mascot } from '../components/mascot/Mascot'
import { useReduceMotion } from '../hooks/useReduceMotion'
import { useKnifeSound } from '../hooks/useSound'
import { useTheme } from '../theme/ThemeProvider'

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
  /** His line is shown under the gauge: the bubble doesn't repeat it, and keeps to reactions and chatter. */
  lineInHero?: boolean
}

/**
 * The Today screen's duck: `duck` sits beside the hero's gauge, `speech` is
 * the bubble he talks in, rising above him. He speaks for a few seconds and
 * falls quiet: when Today opens, when his line changes (the day starts, a task
 * is ticked, the clock gets close), when he reacts (a poke, a glare, a saved
 * plan), and now and then on his own with one of his catchphrases. His mood
 * follows the menace; the third quick poke makes him lunge. The web's useDuck
 * (src/screens/Today/DuckHeader.tsx).
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
  lineInHero = false,
}: DuckProps): { duck: ReactNode; speech: ReactNode; line: string } {
  const playShing = useKnifeSound()
  const [reaction, setReaction] = useState<{ kind: DuckReaction; id: number }>()
  const [speech, setSpeech] = useState<{ text: string; ms: number; announce: boolean; id: number } | null>(null)
  // What he said last, so a catchphrase never repeats it.
  const [lastSaid, setLastSaid] = useState<string>()
  const pokes = useRef<number[]>([])
  const pokeCount = useRef(0)

  // `announce`: VoiceOver reads it out. His lines about the day, a plan or a glare are; chatter and pokes aren't.
  const say = (text: string, ms = SPEECH_MS, announce = true) => {
    setLastSaid(text)
    setSpeech((previous) => ({ text, ms, announce, id: (previous?.id ?? 0) + 1 }))
  }

  const react = (kind: DuckReaction, text?: string, announce = true) => {
    setReaction((previous) => ({ kind, id: (previous?.id ?? 0) + 1 }))
    if (text !== undefined) say(text, REACTION_MS, announce)
  }

  const line = duckLine({ menace, missing, dayNumber, name, started, yesterdayOpen })

  // Which tasks are done, as text: the day is read afresh after every write, and only a real change counts.
  const done = TASK_IDS.filter((task) => completion[task]).join()
  const [seen, setSeen] = useState({ dayNumber, done, announcement, line })
  if (seen.dayNumber !== dayNumber || seen.done !== done || seen.announcement !== announcement || seen.line !== line) {
    setSeen({ dayNumber, done, announcement, line })
    const before = seen.done.split(',')
    const now = done.split(',')
    if (announcement && announcement !== seen.announcement) {
      react(announcement.reaction, announcement.text)
    } else if (seen.dayNumber === dayNumber && before.some((task) => task !== '' && !now.includes(task))) {
      // A new day starts with nothing ticked; that isn't a task being unticked.
      react('glare', GLARE_LINE)
    } else {
      if (seen.dayNumber === dayNumber && now.some((task) => task !== '' && !before.includes(task))) react('approve')
      if (seen.line !== line && !lineInHero) say(line)
    }
  }

  // Each line falls quiet after its time, and is said aloud when it is one worth hearing.
  useEffect(() => {
    if (!speech) return
    if (speech.announce) AccessibilityInfo.announceForAccessibility(speech.text)
    const timer = setTimeout(() => setSpeech(null), speech.ms)
    return () => clearTimeout(timer)
  }, [speech])

  // The day's line, a beat after Today opens; then a catchphrase now and then.
  const greet = useEffectEvent(() => {
    if (!lineInHero) say(line)
  })
  const chatter = useEffectEvent(() => say(nextCatchphrase(menace.level, lastSaid), SPEECH_MS, false))
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
    const result = registerPoke(pokes.current, Date.now())
    pokes.current = result.recent
    playShing()
    if (result.kind === 'lunge') {
      react('lunge', LUNGE_LINE, false)
      onLunge()
    } else {
      react('poke', pokeLine(pokeCount.current), false)
      pokeCount.current += 1
    }
  }

  return {
    line,
    duck: (
      <Pressable accessibilityRole="button" accessibilityLabel="Poke the duck" onPress={poke} style={styles.duck}>
        <Mascot mood={LEVEL_MOODS[menace.level]} size={64} reaction={reaction} decorative />
      </Pressable>
    ),
    // Above the duck, rising from him, and no wider than his column plus the margin to its left: never over the gauge's bars.
    speech: speech ? <Bubble key={speech.id} text={speech.text} /> : null,
  }
}

/** What he says, in a bubble with its tail pointing down at him. It pops in; under reduce motion it only fades in. */
function Bubble({ text }: { text: string }) {
  const { colors, fonts } = useTheme()
  const reduceMotion = useReduceMotion()
  const shown = useState(() => new Animated.Value(0))[0]
  useEffect(() => {
    const popping = Animated.timing(shown, { toValue: 1, duration: 180, useNativeDriver: true })
    popping.start()
    return () => popping.stop()
  }, [shown])
  const rise = reduceMotion ? 0 : shown.interpolate({ inputRange: [0, 1], outputRange: [6, 0] })
  const grow = reduceMotion ? 1 : shown.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] })
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.bubble, { backgroundColor: colors.surface, opacity: shown, transform: [{ translateY: rise }, { scale: grow }] }]}
    >
      <View style={[styles.tail, { backgroundColor: colors.surface }]} />
      <Text numberOfLines={4} style={[styles.words, { color: colors.ink, fontFamily: fonts.rounded.bold }]}>
        {text}
      </Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  duck: { borderRadius: 16 },
  bubble: {
    position: 'absolute',
    bottom: '100%',
    left: -20,
    zIndex: 2,
    marginBottom: 8,
    maxWidth: 124,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  tail: { position: 'absolute', bottom: -5, left: 40, width: 12, height: 12, transform: [{ rotate: '45deg' }] },
  words: { fontSize: 12, lineHeight: 16 },
})

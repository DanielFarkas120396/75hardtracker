import { TASK_IDS } from '@logic/dayCompletion'
import type { DuckMood, DuckReaction } from '@logic/duckRig'
import type { MenaceLevel } from '@logic/menace'
import type { TaskId } from '@logic/types'
import { useState, type ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { FlameStreak, GaugeRing } from '../components/GaugeRing'
import { Icon } from '../components/icons/Icon'
import { Mascot } from '../components/mascot/Mascot'
import { DuckGlow } from '../onboarding/parts'
import { useTheme } from '../theme/ThemeProvider'

const LEVEL_MOODS: Record<MenaceLevel, DuckMood> = {
  content: 'content',
  watching: 'watching',
  tapping: 'tapping',
  hunting: 'hunting',
}

interface TodayHeroProps {
  /** "75 Hard #1". */
  attemptLine: string
  dayNumber: number
  completedCount: number
  streak: number
  /** Jokers left, or undefined when the ruleset has none. */
  jokersLeft: number | undefined
  /** The duck's mood follows the menace. */
  level: MenaceLevel
  completion: Record<TaskId, boolean>
  /** The player's reason, quoted at the bottom. */
  why?: string
  /** Under the gauge: "Day N won" and the closing ritual, the time left late in the evening, the next plan, or the duck's line. */
  below: ReactNode
}

/**
 * The top of Today, on the world's sunrise glow, built around the gauge of
 * tasks done: the day and the attempt on one line above it; the duck on its
 * left; the streak and the jokers on its right; what matters next under it;
 * and the player's reason at the bottom. The web's TodayHero. The duck nods
 * at a task ticked and glares at one unticked; his bubble, his chatter and
 * his answer to a poke come with part 4b.
 */
export function TodayHero({ attemptLine, dayNumber, completedCount, streak, jokersLeft, level, completion, why, below }: TodayHeroProps) {
  const { colors, fonts } = useTheme()

  // Which tasks are done, compared with the render before: a tick gets a nod, an untick a glare.
  const done = TASK_IDS.filter((task) => completion[task]).join()
  const [seen, setSeen] = useState(done)
  const [reaction, setReaction] = useState<{ kind: DuckReaction; id: number }>()
  if (seen !== done) {
    setSeen(done)
    const before = seen.split(',')
    const now = done.split(',')
    const kind: DuckReaction | undefined = before.some((task) => task !== '' && !now.includes(task))
      ? 'glare'
      : now.some((task) => task !== '' && !before.includes(task))
        ? 'approve'
        : undefined
    if (kind) setReaction((previous) => ({ kind, id: (previous?.id ?? 0) + 1 }))
  }

  return (
    <View style={styles.hero}>
      <DuckGlow reach={{ left: -32, right: -32, top: -80, bottom: -24 }} />

      {/* One line, never wrapping: the day, then the attempt. The attempt is in full ink: over the glow's core the muted grey reads too faintly. */}
      <View accessible accessibilityRole="header" accessibilityLabel={`Day ${dayNumber}, ${attemptLine}`} style={styles.heading}>
        <Text style={[styles.day, { color: colors.ink, fontFamily: fonts.display.semibold }]}>Day {dayNumber}</Text>
        <Text style={[styles.attempt, { color: colors.ink, fontFamily: fonts.rounded.semibold }]}>{attemptLine}</Text>
      </View>

      {/* Three columns, so the gauge sits in the true centre: the duck, the gauge, the streak and jokers. */}
      <View style={styles.columns}>
        <View style={styles.side}>
          <Mascot mood={LEVEL_MOODS[level]} size={64} reaction={reaction} />
        </View>
        <View style={styles.centre}>
          <GaugeRing value={completedCount} max={TASK_IDS.length} />
          {below}
        </View>
        <View style={[styles.side, styles.right]}>
          {/* No streak yet on Day 1: a grey "0" flame says nothing. */}
          {streak > 0 && <FlameStreak streak={streak} />}
          {jokersLeft !== undefined && (
            <View style={styles.jokers}>
              <Icon name="joker" size={16} color={colors.orangeInk} />
              <Text style={[styles.attempt, { color: colors.orangeInk, fontFamily: fonts.rounded.semibold }]}>
                {jokersLeft} {jokersLeft === 1 ? 'joker' : 'jokers'}
              </Text>
            </View>
          )}
        </View>
      </View>

      {why !== undefined && (
        <Text numberOfLines={2} style={[styles.why, { color: colors.inkMuted, fontFamily: fonts.quote }]}>
          “{why}”
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  hero: { marginHorizontal: 16, marginVertical: 12, padding: 12 },
  heading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 8 },
  day: { fontSize: 36, lineHeight: 38, letterSpacing: 0.9 },
  attempt: { fontSize: 12 },
  columns: { marginTop: 12, flexDirection: 'row', alignItems: 'flex-end' },
  side: { width: 72, alignItems: 'flex-start' },
  right: { alignItems: 'flex-end', alignSelf: 'center', gap: 8 },
  centre: { flex: 1, alignItems: 'center', gap: 4 },
  jokers: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  why: { marginTop: 12, fontSize: 14, lineHeight: 19, textAlign: 'center' },
})

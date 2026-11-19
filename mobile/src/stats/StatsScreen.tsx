import type { ChallengeGate } from '@logic/challengeGate'
import { CHALLENGE_LENGTH } from '@logic/constants'
import { rulesFor } from '@logic/rulesets'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { FlameStreak } from '../components/FlameStreak'
import { Icon } from '../components/icons/Icon'
import { useChallengeStats } from '../endings/stats'
import { useTheme } from '../theme/ThemeProvider'
import { BodySection } from './BodySection'
import { BookShelfArt, BottleArt, StatTile } from './StatTiles'
import { useWorkoutHistory, WorkoutsSection, WorkoutTotals } from './WorkoutsSection'

/**
 * The attempt as a story: the weight first, the training totals, what else it took (water, pages), then each
 * workout. Today and Journey show the day. The web's StatsScreen.
 */
export function StatsScreen({ gate }: { gate: ChallengeGate }) {
  const { colors, fonts } = useTheme()
  const { challenge, streak, today, todayDayNumber } = gate
  const stats = useChallengeStats(challenge.id)
  const history = useWorkoutHistory(challenge.id)
  const rules = rulesFor(challenge)
  const dayReached = gate.kind === 'completed' ? CHALLENGE_LENGTH : todayDayNumber
  // The bottle fills against the water owed so far, so it means something from Day 1.
  const daysSoFar = Math.min(CHALLENGE_LENGTH, Math.max(1, Number.isFinite(dayReached) ? dayReached : 1))

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.canvas }]}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.attempt, { color: colors.inkMuted, fontFamily: fonts.rounded.semibold }]}>Attempt #{challenge.attemptNumber}</Text>
            <View accessible accessibilityRole="header" accessibilityLabel="Stats" style={styles.titleRow}>
              <Icon name="stats" color={colors.worldInk} />
              <Text style={[styles.title, { color: colors.ink, fontFamily: fonts.display.semibold }]}>Stats</Text>
            </View>
          </View>
          <FlameStreak streak={streak} />
        </View>

        <BodySection today={today} startDate={challenge.startDate} lastDay={daysSoFar} />
        <WorkoutTotals history={history} />
        <View style={styles.tiles}>
          <StatTile
            art={<BottleArt fill={stats.water_ml / (rules.waterTargetMl * daysSoFar)} />}
            value={`${(stats.water_ml / 1000).toFixed(1)} L`}
            label="Water drunk"
            tone={colors.blueInk}
          />
          <StatTile art={<BookShelfArt pages={stats.pages} />} value={`${stats.pages}`} label="Pages read" tone={colors.worldInk} />
        </View>
        <WorkoutsSection history={history} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { gap: 16, paddingHorizontal: 16, paddingBottom: 96 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 24 },
  attempt: { fontSize: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 24, letterSpacing: 0.6 },
  tiles: { flexDirection: 'row', gap: 12 },
})

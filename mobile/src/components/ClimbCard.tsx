import { climbSegments } from '@logic/climb'
import { CHALLENGE_LENGTH } from '@logic/constants'
import { WORLD_SPANS, worldSpanForDay } from '@logic/worlds'
import { StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'
import { withAlpha } from '../theme/tokens'
import { Icon } from './icons/Icon'

/**
 * The climb so far: the day reached, its world, and a bar split into the six worlds, filled in the world's colour.
 * The web's ClimbCard (src/screens/Stats/ClimbCard.tsx); Journey shows it, Stats will.
 */
export function ClimbCard({ dayReached }: { dayReached: number }) {
  const { colors, fonts, mode } = useTheme()
  const segments = climbSegments(dayReached)
  const day = Number.isFinite(dayReached) ? Math.min(CHALLENGE_LENGTH, Math.max(0, dayReached)) : 0
  const percent = Math.round((day / CHALLENGE_LENGTH) * 100)

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }, mode === 'light' && { borderWidth: 1, borderColor: withAlpha(colors.ink, 0.1) }]}>
      <View style={styles.world}>
        <Icon name="journey" size={16} color={colors.worldInk} />
        <Text style={[styles.worldName, { color: colors.inkMuted, fontFamily: fonts.rounded.semibold }]}>
          {day === 0 ? 'Not started yet' : worldSpanForDay(day).name}
        </Text>
      </View>
      <Text style={styles.dayLine}>
        <Text style={[styles.day, { color: colors.ink, fontFamily: fonts.display.semibold }]}>Day {day}</Text>
        <Text style={[styles.of, { color: colors.inkMuted, fontFamily: fonts.display.semibold }]}> of {CHALLENGE_LENGTH}</Text>
      </Text>

      <View accessible accessibilityRole="image" accessibilityLabel={`${percent}% of the climb, through ${WORLD_SPANS.length} worlds`} style={styles.bar}>
        {segments.map((segment) => (
          <View key={segment.id} style={[styles.segment, { flexGrow: segment.share, backgroundColor: withAlpha(colors.ink, 0.1) }]}>
            <View style={[styles.segmentFill, { width: `${segment.fill * 100}%`, backgroundColor: colors.world }]} />
          </View>
        ))}
      </View>
      <Text style={[styles.percent, { color: colors.inkMuted, fontFamily: fonts.rounded.semibold }]}>{percent}% of the climb from Hell to Heaven</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, padding: 16 },
  world: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  worldName: { fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase' },
  dayLine: { marginTop: 4 },
  day: { fontSize: 36, lineHeight: 38, letterSpacing: 0.9 },
  of: { fontSize: 18, letterSpacing: 0.45 },
  bar: { marginTop: 16, height: 10, flexDirection: 'row', gap: 4 },
  segment: { flexBasis: 0, height: '100%', borderRadius: 5, overflow: 'hidden' },
  segmentFill: { position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: 5 },
  percent: { marginTop: 10, fontSize: 12 },
})

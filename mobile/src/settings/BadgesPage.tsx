import { BADGE_DEFINITIONS } from '@logic/badges'
import { StyleSheet, Text, View } from 'react-native'
import { badgeRepo } from '../db/repositories/badgeRepo'
import { useLiveQuery } from '../db/useLiveQuery'
import { useTheme } from '../theme/ThemeProvider'
import { Card, CardTitle, Muted } from './rows'

/** Every badge, the unlocked ones gold. Locked ones are quieter (a lock, a muted name), not faded, so they stay readable. */
export function BadgesPage({ challengeId }: { challengeId: number }) {
  const { colors, fonts } = useTheme()
  const unlocked = useLiveQuery(() => badgeRepo.getForChallenge(challengeId), [challengeId]) ?? []
  const unlockedIds = new Set(unlocked.map((badge) => badge.badgeId))
  return (
    <Card>
      <CardTitle>
        Badges ({unlockedIds.size}/{BADGE_DEFINITIONS.length})
      </CardTitle>
      <View style={styles.grid}>
        {BADGE_DEFINITIONS.map((badge) => {
          const isUnlocked = unlockedIds.has(badge.id)
          return (
            <View
              key={badge.id}
              accessible
              accessibilityLabel={`${badge.name}, ${isUnlocked ? 'unlocked' : 'locked'}. ${badge.description}`}
              style={[styles.badge, { backgroundColor: isUnlocked ? colors.yellowLight : colors.canvas }]}
            >
              <Text style={styles.icon}>{isUnlocked ? '🏅' : '🔒'}</Text>
              <Text style={[styles.name, { color: isUnlocked ? colors.ink : colors.inkMuted, fontFamily: fonts.rounded.bold }]}>{badge.name}</Text>
              <Muted size={12} top={0}>
                {badge.description}
              </Muted>
            </View>
          )
        })}
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  grid: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { width: '48.5%', borderRadius: 16, padding: 12 },
  icon: { fontSize: 20 },
  name: { marginTop: 4, fontSize: 14 },
})

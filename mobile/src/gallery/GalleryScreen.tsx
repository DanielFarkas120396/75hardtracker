import type { ChallengeGate } from '@logic/challengeGate'
import { router } from 'expo-router'
import { useMemo, useState } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { FlameStreak } from '../components/FlameStreak'
import { Icon } from '../components/icons/Icon'
import { Mascot } from '../components/mascot/Mascot'
import { Button } from '../components/ui/Button'
import { useReduceMotion } from '../hooks/useReduceMotion'
import { useTabBarHidden } from '../hooks/useTabBar'
import { useTheme } from '../theme/ThemeProvider'
import { withAlpha } from '../theme/tokens'
import { requestCamera } from './cameraRequest'
import { Overlay } from './parts'
import { PhotoCompare } from './PhotoCompare'
import { PhotoLightbox } from './PhotoLightbox'
import { useGalleryPhotos, type GalleryEntry } from './useGalleryPhotos'

/** What the Gallery's one overlay shows: a photo, or Compare. */
type Shown = { kind: 'photo'; index: number } | { kind: 'compare' }

/**
 * This attempt's progress photos in one grid, newest first, with Compare on top. With none yet, the duck sends you to
 * take one. The web's GalleryScreen (src/screens/Gallery/GalleryScreen.tsx).
 */
export function GalleryScreen({ gate }: { gate: ChallengeGate }) {
  const { colors, fonts } = useTheme()
  const { challenge, streak, today } = gate
  const entries = useGalleryPhotos(gate.dayEntries, challenge.attemptNumber)
  const [shown, setShown] = useState<Shown | null>(null)
  // Newest first in the grid; oldest first for Compare.
  const oldestFirst = useMemo(() => (entries ?? []).toReversed(), [entries])
  const first = oldestFirst[0]
  const latest = oldestFirst.at(-1)
  // A screen that covers the app brings Today forward: the overlay closes first, so its Modal never stays up over Today.
  const covered = useTabBarHidden()
  if (covered && shown !== null) setShown(null)

  const takePhoto = () => {
    requestCamera(today)
    router.navigate('/')
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.canvas }]}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.attempt, { color: colors.inkMuted, fontFamily: fonts.rounded.semibold }]}>Attempt #{challenge.attemptNumber}</Text>
            <View accessible accessibilityRole="header" accessibilityLabel="Gallery" style={styles.titleRow}>
              <Icon name="gallery" color={colors.worldInk} />
              <Text style={[styles.title, { color: colors.ink, fontFamily: fonts.display.semibold }]}>Gallery</Text>
            </View>
          </View>
          <FlameStreak streak={streak} />
        </View>

        {!entries ? (
          <Text style={[styles.loading, { color: colors.inkMuted, fontFamily: fonts.rounded.regular }]}>Loading…</Text>
        ) : entries.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: colors.worldSoft }]}>
            <View>
              <Mascot mood="content" size={120} decorative />
              <View style={[styles.emptyBadge, { backgroundColor: colors.surface }]}>
                <Icon name="photo" size={26} color={colors.worldInk} />
              </View>
            </View>
            <Text accessibilityRole="header" style={[styles.emptyTitle, { color: colors.ink, fontFamily: fonts.display.semibold }]}>
              No photos yet
            </Text>
            <Text style={[styles.emptyText, { color: colors.inkMuted, fontFamily: fonts.rounded.regular }]}>
              One photo a day, and in 75 days you'll see how far you climbed.
            </Text>
            <Button label="Take today's photo" onPress={takePhoto} />
          </View>
        ) : (
          <>
            {first && latest && first !== latest && <ComparePill first={first} latest={latest} onPress={() => setShown({ kind: 'compare' })} />}
            <Grid entries={entries} onOpen={(index) => setShown({ kind: 'photo', index })} />
          </>
        )}
      </ScrollView>

      <Overlay open={shown !== null} onClose={() => setShown(null)}>
        {shown?.kind === 'photo' && (
          <PhotoLightbox entries={entries ?? []} index={shown.index} onClose={() => setShown(null)} onNavigate={(index) => setShown({ kind: 'photo', index })} />
        )}
        {shown?.kind === 'compare' && oldestFirst.length > 1 && <PhotoCompare entries={oldestFirst} onClose={() => setShown(null)} />}
      </Overlay>
    </SafeAreaView>
  )
}

function ComparePill({ first, latest, onPress }: { first: GalleryEntry; latest: GalleryEntry; onPress: () => void }) {
  const { colors, fonts } = useTheme()
  const reduceMotion = useReduceMotion()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Compare, Day ${first.dayNumber} → Day ${latest.dayNumber}`}
      onPress={onPress}
      style={({ pressed }) => [styles.pill, { backgroundColor: colors.worldSoft, borderColor: colors.worldEdge }, pressed && !reduceMotion && styles.pillPressed]}
    >
      <View style={styles.faces}>
        {[first, latest].map((entry, i) => (
          <Image key={entry.photo.id} source={{ uri: entry.photo.uri }} style={[styles.face, { borderColor: colors.worldSoft }, i > 0 && styles.faceBehind]} />
        ))}
      </View>
      <View>
        <Text style={[styles.pillTitle, { color: colors.worldInk, fontFamily: fonts.rounded.bold }]}>Compare</Text>
        <Text style={[styles.pillDays, { color: colors.inkMuted, fontFamily: fonts.rounded.regular }]}>
          Day {first.dayNumber} → Day {latest.dayNumber}
        </Text>
      </View>
    </Pressable>
  )
}

function Grid({ entries, onOpen }: { entries: readonly GalleryEntry[]; onOpen: (index: number) => void }) {
  const { colors, fonts } = useTheme()
  const reduceMotion = useReduceMotion()
  const { width } = useWindowDimensions()
  // Three across, 16 points from each edge, 8 between.
  const size = Math.floor((width - 32 - 16) / 3)
  return (
    <View style={styles.grid}>
      {entries.map((entry, index) => (
        <Pressable
          key={entry.photo.id}
          accessibilityRole="button"
          accessibilityLabel={`Day ${entry.dayNumber} progress`}
          onPress={() => onOpen(index)}
          style={({ pressed }) => [
            styles.tile,
            { width: size, height: size, backgroundColor: colors.worldSoft, borderColor: withAlpha(colors.world, 0.4) },
            pressed && !reduceMotion && styles.tilePressed,
          ]}
        >
          <Image source={{ uri: entry.photo.uri }} style={StyleSheet.absoluteFill} />
          <Text style={[styles.tileDay, { fontFamily: fonts.rounded.bold }]}>Day {entry.dayNumber}</Text>
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { gap: 20, paddingHorizontal: 16, paddingBottom: 96 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 24 },
  attempt: { fontSize: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 24, letterSpacing: 0.6 },
  loading: { fontSize: 16 },
  empty: { alignItems: 'center', gap: 12, borderRadius: 20, paddingHorizontal: 24, paddingVertical: 32 },
  emptyBadge: { position: 'absolute', right: -8, bottom: 8, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  emptyTitle: { fontSize: 20, letterSpacing: 0.5 },
  emptyText: { maxWidth: 320, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  pill: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'center', borderRadius: 999, borderWidth: 1.5, paddingVertical: 6, paddingLeft: 6, paddingRight: 20 },
  pillPressed: { transform: [{ scale: 0.97 }] },
  faces: { flexDirection: 'row' },
  face: { width: 36, height: 36, borderRadius: 18, borderWidth: 2 },
  faceBehind: { marginLeft: -10 },
  pillTitle: { fontSize: 16, lineHeight: 20 },
  pillDays: { fontSize: 12, lineHeight: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { overflow: 'hidden', borderRadius: 16, borderWidth: 2, justifyContent: 'flex-end', alignItems: 'flex-start', padding: 4 },
  tilePressed: { transform: [{ scale: 0.95 }] },
  tileDay: { overflow: 'hidden', borderRadius: 8, backgroundColor: 'rgba(0, 0, 0, 0.6)', paddingHorizontal: 8, paddingVertical: 2, color: '#ffffff', fontSize: 12 },
})

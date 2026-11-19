import { formatDisplayDate } from '@logic/dates'
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'
import { CloseButton, PillButton } from './parts'
import type { GalleryEntry } from './useGalleryPhotos'

interface PhotoLightboxProps {
  entries: readonly GalleryEntry[]
  index: number
  onClose: () => void
  onNavigate: (index: number) => void
}

/**
 * One photo, as large as it fits, with its attempt, day and date, and Older / Newer. A tap beside it closes it. The
 * web's PhotoLightbox (src/screens/Gallery/PhotoLightbox.tsx). Drawn inside the Gallery's one overlay.
 */
export function PhotoLightbox({ entries, index, onClose, onNavigate }: PhotoLightboxProps) {
  const { fonts } = useTheme()
  const { height } = useWindowDimensions()
  const entry = entries[index]
  if (!entry) return null
  return (
    <View style={styles.view}>
      <Pressable testID="lightbox-backdrop" accessible={false} onPress={onClose} style={StyleSheet.absoluteFill} />
      <View pointerEvents="box-none" style={styles.content}>
        <Image
          source={{ uri: entry.photo.uri }}
          accessible
          accessibilityLabel={`Day ${entry.dayNumber} progress`}
          resizeMode="contain"
          style={[styles.photo, { height: height * 0.7 }]}
        />
        <Text style={[styles.caption, { fontFamily: fonts.rounded.bold }]}>
          Attempt #{entry.attemptNumber} — Day {entry.dayNumber} · {formatDisplayDate(entry.date)}
        </Text>
        <View style={styles.buttons}>
          <PillButton label="← Older" disabled={index >= entries.length - 1} onPress={() => onNavigate(index + 1)} />
          <PillButton label="Newer →" disabled={index <= 0} onPress={() => onNavigate(index - 1)} />
        </View>
      </View>
      <CloseButton onPress={onClose} />
    </View>
  )
}

const styles = StyleSheet.create({
  view: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.9)' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 16 },
  photo: { width: '100%', borderRadius: 16 },
  caption: { color: '#ffffff', fontSize: 16, textAlign: 'center' },
  buttons: { flexDirection: 'row', gap: 16 },
})
